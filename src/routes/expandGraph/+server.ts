import { AtpAgent } from '@atproto/api';
import { json } from '@sveltejs/kit';
import { BSKY_DID, BSKY_PASSWORD } from '$env/static/private';
import { getPds } from '$lib/server/getPds';
import { Buffer } from 'buffer';

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

export async function POST({ request }) {
  console.log('Expanding graph via API endpoint...');
  const { did: didToExpand } = await request.json();

  if (!didToExpand) {
    return json({ error: 'DID is required' }, { status: 400 });
  }

  if (!BSKY_DID || !BSKY_PASSWORD) {
    console.error('Bluesky DID or password not set in environment variables.');
    return json({ error: 'Server configuration error' }, { status: 500 });
  }

  await agent.login({
    identifier: BSKY_DID,
    password: BSKY_PASSWORD,
  });

  const relatedRecords = await fetchAllRecords(
    didToExpand,
    'com.skybemoreblue.intro.introduction'
  );

  const newDids = new Set<string>();
  relatedRecords.forEach((record: any) => {
    if (record.value?.subject) {
      newDids.add(record.value.subject);
    }
  });
  newDids.add(didToExpand);

  const profiles = await fetchAllProfiles(Array.from(newDids));

  const newNodes: any[] = [];
  const newEdges: any[] = [];
  const didToProfileMap = new Map<string, any>();

  for (const profile of profiles) {
    didToProfileMap.set(profile.did, profile);
    const rank = getRank({
      followersCount: profile.followersCount || 0,
      followsCount: profile.followsCount || 1,
    });

    newNodes.push({
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

  relatedRecords.forEach((record: any) => {
    if (record.value?.subject && didToProfileMap.has(record.repo) && didToProfileMap.has(record.value.subject)) {
      newEdges.push({
        data: {
          source: record.repo,
          target: record.value.subject,
        },
        group: 'edges',
      });
    }
  });

  return json({
    graphData: {
      nodes: newNodes,
      edges: newEdges,
    },
  });
}
