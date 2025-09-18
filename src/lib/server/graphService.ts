import { AtpAgent } from '@atproto/api';
import { imageToBase64 } from '$lib/server/util';
import { BSKY_DID, BSKY_PASSWORD } from '$env/static/private';
import { getPds } from '$lib/server/getPds';
import { Buffer } from 'buffer';
import type { PageServerLoadOutput } from '../../$types';

const agent = new AtpAgent({
  service: 'https://bsky.social',
});

const RANK_COEF = 30;
const RANK_BIAS = 50;
const RANK_LOWEST = 20;
const RANK_HIGHEST = 60;

export function getRank(actor: { followersCount: number; followsCount: number }) {
  const rank = Math.log10((actor.followersCount / actor.followsCount) * 1000) * RANK_COEF - RANK_BIAS;
  let correctedRank;
  if (RANK_HIGHEST < rank) {
    correctedRank = RANK_HIGHEST;
  } else if (RANK_LOWEST > rank) {
    correctedRank = RANK_LOWEST;
  } else {
    correctedRank = rank;
  }
  return correctedRank;
}

export async function fetchAllRecords(
  repo: string,
  collection: string,
  cursor?: string,
  allRecords: any[] = []
): Promise<any[]> {
  try {
    const agentPds = new AtpAgent({service: await getPds(repo)});
    const response = await agentPds.com.atproto.repo.listRecords({
      repo,
      collection,
      limit: 100,
      cursor,
    });

    allRecords.push(...response.data.records);

    if (response.data.cursor) {
      return fetchAllRecords(repo, collection, response.data.cursor, allRecords);
    }

    return allRecords;
  } catch (error) {
    console.error(`Error fetching records for repo ${repo}:`, error);
    return [];
  }
}

export async function fetchAllProfiles(
  dids: string[],
  allProfiles: any[] = []
): Promise<any[]> {
  const chunkSize = 25;
  for (let i = 0; i < dids.length; i += chunkSize) {
    const chunk = dids.slice(i, i + chunkSize);
    const response = await agent.getProfiles({
      actors: chunk,
    });
    allProfiles.push(...response.data.profiles);
  }

  return allProfiles;
}

export async function getGraphData(centerNodeHandle: string): Promise<PageServerLoadOutput> {
  try {
    console.log('Fetching data from Bluesky for handle:', centerNodeHandle);

    if (!BSKY_DID || !BSKY_PASSWORD) {
      console.error('Bluesky DID or password not set in environment variables.');
      return {
        graphData: {
          nodes: [],
          edges: [],
        },
        initialCenterDid: '',
      };
    }

    await agent.login({
      identifier: BSKY_DID,
      password: BSKY_PASSWORD,
    });

    const centerNodeProfile = await agent.resolveHandle({handle: centerNodeHandle});
    const centerNodeDid = centerNodeProfile.data.did;

    const initialDids = new Set<string>();
    initialDids.add(centerNodeDid);

    // Fetch initial introductions from the center node to discover connected nodes
    const centerNodeIntroRecords = await fetchAllRecords(
      centerNodeDid,
      'com.skybemoreblue.intro.introduction'
    );
    centerNodeIntroRecords.forEach((record: any) => {
      if (record.value?.subject) {
        initialDids.add(record.value.subject);
      }
    });

    // Fetch all introduction records where any of the initialDids are authors
    const allIntroRecordsPromises = Array.from(initialDids).map(did =>
      fetchAllRecords(did, 'com.skybemoreblue.intro.introduction')
    );
    const allIntroRecordsArrays = await Promise.all(allIntroRecordsPromises);
    const allIntroRecords = allIntroRecordsArrays.flat();

    const introRecordsMap = new Map<string, any[]>();
    allIntroRecords.forEach((record: any) => {
      if (record.value?.subject) {
        const authorDid = record.uri.split('/')[2];
        const intro = { ...record.value, author: authorDid };
        if (introRecordsMap.has(record.value.subject)) {
          introRecordsMap.get(record.value.subject)?.push(intro);
        } else {
          introRecordsMap.set(record.value.subject, [intro]);
        }
      }
    });

    const profiles = await fetchAllProfiles(Array.from(initialDids));

    const nodes: any[] = [];
    const edges: any[] = [];
    const didToProfileMap = new Map<string, any>();

    for (const profile of profiles) {
      didToProfileMap.set(profile.did, profile);
      const rank = getRank({
        followersCount: profile.followersCount || 0,
        followsCount: profile.followsCount || 1,
      });

      const introductions = introRecordsMap.get(profile.did) || [];
      const allTags = new Set<string>();
      introductions.forEach((intro) => {
        if (intro.tags) {
          intro.tags.forEach((tag: string) => allTags.add(tag));
        }
      });

      nodes.push({
        data: {
          id: profile.did,
          img: profile.avatar ? await imageToBase64(profile.avatar) : null,
          name: profile.displayName || profile.handle,
          rank: rank,
          handle: profile.handle,
          introductions: introductions,
          tags: Array.from(allTags),
        },
        group: 'nodes',
      });
    }

    centerNodeIntroRecords.forEach((record: any) => {
      if (record.value?.subject && didToProfileMap.has(centerNodeDid) && didToProfileMap.has(record.value.subject)) {
        edges.push({
          data: {
            source: centerNodeDid,
            target: record.value.subject,
          },
          group: 'edges',
        });
      }
    });

    return {
      graphData: {
        nodes,
        edges,
      },
      initialCenterDid: centerNodeDid,
    };
  } catch (error) {
    console.error('Error in getGraphData function:', error);
    return {
      graphData: {
        nodes: [],
        edges: [],
      },
      initialCenterDid: '',
    };
  }
}
