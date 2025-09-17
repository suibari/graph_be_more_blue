import { AtpAgent } from '@atproto/api';
import type { ServerLoad } from '@sveltejs/kit';
import { imageToBase64 } from '$lib/server/util';

export type Introduction = {
  body: string;
  lang: string;
  tags: string[];
  $type: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  author: string;
};

export type GraphNode = {
  data: {
    id: string;
    img: string | null;
    name: string;
    rank: number;
    handle: string;
    introductions: Introduction[]; // 配列に変更
    tags?: string[];
  };
  group: 'nodes';
};

export type GraphEdge = {
  data: {
    source: string;
    target: string;
  };
  group: 'edges';
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type PageServerLoadOutput = {
  graphData: GraphData;
  initialCenterDid: string;
};

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

export const load: ServerLoad = async (): Promise<PageServerLoadOutput> => {
  try {
    console.log('Fetching data from Bluesky...');

    if (!BSKY_DID || !BSKY_PASSWORD) {
      console.error('Bluesky DID or password not set in environment variables.');
      return {
        graphData: {
          nodes: [],
          edges: [],
        },
        initialCenterDid: '', // ここにinitialCenterDidを追加
      };
    }

    await agent.login({
      identifier: BSKY_DID,
      password: BSKY_PASSWORD,
    });

    const centerNodeHandle = 'so-asano.com'; // 変数名を変更
    const centerNodeProfile = await agent.resolveHandle({handle: centerNodeHandle}); // 変数名を変更
    const centerNodeDid = centerNodeProfile.data.did; // 変数名を変更

    const introRecords = await fetchAllRecords(
      centerNodeDid, // DIDを使用
      'com.skybemoreblue.intro.introduction'
    );

    const introRecordsMap = new Map<string, any>();
    introRecords.forEach((record: any) => {
      if (record.value?.subject) {
        const authorDid = record.uri.split('/')[2];
        introRecordsMap.set(record.value.subject, { ...record.value, author: authorDid });
      }
    });

    const initialDids = new Set<string>();
    introRecords.forEach((record: any) => {
      if (record.value?.subject) {
        initialDids.add(record.value.subject);
      }
    });
    initialDids.add(centerNodeDid); // 変数名を変更

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

      const introduction = introRecordsMap.get(profile.did);

      nodes.push({
        data: {
          id: profile.did,
          img: profile.avatar ? await imageToBase64(profile.avatar) : null,
          name: profile.displayName || profile.handle,
          rank: rank,
          handle: profile.handle,
          introductions: introduction ? [introduction] : [], // 配列として初期化
          tags: introduction ? introduction.tags : [],
        },
        group: 'nodes',
      });
    }

    introRecords.forEach((record: any) => {
      if (record.value?.subject && didToProfileMap.has(centerNodeDid) && didToProfileMap.has(record.value.subject)) { // 変数名を変更
        edges.push({
          data: {
            source: centerNodeDid, // 変数名を変更
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
      initialCenterDid: centerNodeDid, // 変数名を変更
    };
  } catch (error) {
    console.error('Error in load function:', error);
    return {
      graphData: {
        nodes: [],
        edges: [],
      },
      initialCenterDid: '', // 変数名を変更
    };
  }
};
