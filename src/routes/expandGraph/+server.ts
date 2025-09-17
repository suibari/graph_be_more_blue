import { AtpAgent } from '@atproto/api';
import { json } from '@sveltejs/kit';
import { BSKY_DID, BSKY_PASSWORD } from '$env/static/private';
import { getPds } from '$lib/server/getPds';
import { imageToBase64 } from '$lib/server/util';

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
    try {
      const response = await agent.getProfiles({
        actors: chunk,
      });
      allProfiles.push(...response.data.profiles);
      console.log(`Fetched profiles for chunk (size ${chunk.length}):`, response.data.profiles.map((p: any) => p.did));
    } catch (error) {
      console.error(`Error fetching profiles for chunk ${chunk}:`, error);
    }
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
  console.log('Fetched relatedRecords count:', relatedRecords.length);
  if (relatedRecords.length > 0) {
    console.log('Example relatedRecord:', relatedRecords[0]);
  }

  const newDids = new Set<string>();
  relatedRecords.forEach((record: any) => {
    if (record.value?.subject) {
      newDids.add(record.value.subject);
    }
  });
  newDids.add(didToExpand);
  console.log('New DIDs to fetch profiles for:', Array.from(newDids));

  const profiles = await fetchAllProfiles(Array.from(newDids));
  console.log('Total profiles fetched:', profiles.length);
  console.log('Profiles DIDs:', profiles.map((p: any) => p.did));

  const introRecordsMap = new Map<string, any>();
  relatedRecords.forEach((record: any) => {
    if (record.value?.subject) {
      const authorDid = record.uri.split('/')[2];
      introRecordsMap.set(record.value.subject, { ...record.value, author: authorDid });
    }
  });

  const newNodes: any[] = [];
  const newEdges: any[] = [];
  const didToProfileMap = new Map<string, any>();

  for (const profile of profiles) {
    didToProfileMap.set(profile.did, profile);
    const rank = getRank({
      followersCount: profile.followersCount || 0,
      followsCount: profile.followsCount || 1,
    });

    const introduction = introRecordsMap.get(profile.did);

    newNodes.push({
      data: {
        id: profile.did,
        img: profile.avatar ? await imageToBase64(profile.avatar) : null,
        name: profile.displayName || profile.handle,
        rank: rank,
        handle: profile.handle,
        introductions: introduction ? [introduction] : [],
      },
      group: 'nodes',
    });
  }

  console.log('didToProfileMap keys:', Array.from(didToProfileMap.keys())); // デバッグログ追加
  relatedRecords.forEach((record: any) => {
    const sourceDid = record.uri.split('/')[2]; // record.repo から record.uri をパースするように変更
    const targetDid = record.value?.subject;
    console.log(`Processing record: sourceDid=${sourceDid}, targetDid=${targetDid}`); // デバッグログ追加

    if (targetDid && didToProfileMap.has(sourceDid) && didToProfileMap.has(targetDid)) {
      newEdges.push({
        data: {
          source: sourceDid,
          target: targetDid,
        },
        group: 'edges',
      });
      console.log(`Adding edge: ${sourceDid} -> ${targetDid}`);
    } else {
      console.log(`Skipping edge for record:`, record);
      console.log(`  targetDid exists: ${!!targetDid}`);
      console.log(`  sourceDid in map: ${didToProfileMap.has(sourceDid)}`);
      console.log(`  targetDid in map: ${didToProfileMap.has(targetDid)}`);
    }
  });
  console.log('Final newEdges count:', newEdges.length);

  return json({
    graphData: {
      nodes: newNodes,
      edges: newEdges,
    },
  });
}
