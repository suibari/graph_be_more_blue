import { AtpAgent } from '@atproto/api';
import type { ServerLoad } from '@sveltejs/kit';

const agent = new AtpAgent({
  service: 'https://bsky.social',
});

const RANK_COEF = 30;
const RANK_BIAS = 50;
const RANK_LOWEST = 20;
const RANK_HIGHEST = 60;

function getRank(actor: { followersCount: number; followsCount: number }) {
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

async function fetchAllRecords(
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
    return []; // エラーが発生した場合は空の配列を返す
  }
}

async function fetchAllProfiles(
  dids: string[],
  allProfiles: any[] = []
): Promise<any[]> {
  // getProfilesにはcursorがないため、一度にすべてのプロフィールを取得するか、
  // DIDのリストを分割して複数回呼び出す必要があります。
  // 今回はDIDのリストが大きくなる可能性を考慮し、分割して呼び出すようにします。
  const chunkSize = 25; // getProfilesのactorsの最大値は25
  for (let i = 0; i < dids.length; i += chunkSize) {
    const chunk = dids.slice(i, i + chunkSize);
    const response = await agent.getProfiles({
      actors: chunk,
    });
    allProfiles.push(...response.data.profiles);
  }

  return allProfiles;
}

import { BSKY_DID, BSKY_PASSWORD } from '$env/static/private';
import { getPds } from '$lib/server/getPds';
import { Buffer } from 'buffer';

export const load: ServerLoad = async () => {
  try {
    console.log('Fetching data from Bluesky...');

    if (!BSKY_DID || !BSKY_PASSWORD) {
      console.error('Bluesky DID or password not set in environment variables.');
      return {
        graphData: {
          nodes: [],
          edges: [],
        },
      };
    }

    await agent.login({
      identifier: BSKY_DID,
      password: BSKY_PASSWORD,
    });

    const soAsanoHandle = 'so-asano.com';
    const soAsanoProfile = await agent.resolveHandle({handle: soAsanoHandle});
    const soAsanoDid = soAsanoProfile.data.did;

    const introRecords = await fetchAllRecords(
      soAsanoDid, // DIDを使用
      'com.skybemoreblue.intro.introduction'
    );

    const initialDids = new Set<string>();
    introRecords.forEach((record: any) => {
      if (record.value?.subject) {
        initialDids.add(record.value.subject);
      }
    });
    initialDids.add(soAsanoDid);

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

      nodes.push({
        data: {
          id: profile.did,
          img: profile.avatar ? await imageToBase64(profile.avatar) : null,
          name: profile.displayName || profile.handle,
          rank: rank,
          handle: profile.handle,
        },
        group: 'nodes',
      });
    }

    introRecords.forEach((record: any) => {
      if (record.value?.subject && didToProfileMap.has(soAsanoDid) && didToProfileMap.has(record.value.subject)) {
        edges.push({
          data: {
            source: soAsanoDid,
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
    };
  } catch (error) {
    console.error('Error in load function:', error);
    return {
      graphData: {
        nodes: [],
        edges: [],
      },
    };
  }
};
