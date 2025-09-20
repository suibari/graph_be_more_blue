import { AtpAgent } from '@atproto/api';
import { imageToBase64 } from '$lib/server/util';
import { BSKY_DID, BSKY_PASSWORD } from '$env/static/private';
import { getPds } from '$lib/server/getPds';
import { Buffer } from 'buffer';
import type { PageServerLoadOutput } from '../../$types';

let accessJwt: string | undefined;
let refreshJwt: string | undefined;

// キャッシュ関連の変数
const CACHE_TTL = 5 * 60 * 1000; // 5分
let graphDataCache: { [key: string]: { data: any; timestamp: number } } = {}; // より汎用的な型に変更

export const agent = new AtpAgent({
  service: 'https://bsky.social',
});

async function initAgent() {
  if (!BSKY_DID || !BSKY_PASSWORD) {
    console.error('Bluesky DID or password not set in environment variables.');
    throw new Error('Bluesky DID or password not set.');
  }
  const res = await agent.login({
    identifier: BSKY_DID,
    password: BSKY_PASSWORD,
  });
  accessJwt = res.data.accessJwt;
  refreshJwt = res.data.refreshJwt;
}

export async function createOrRefreshSession() {
  if (!accessJwt && !refreshJwt) {
    await initAgent();
    return;
  }

  try {
    await agent.getTimeline();  // 成功すればそのまま
  } catch (err: any) {
    // 失敗した場合（トークン切れなど）
    if (
      err?.response?.data?.error === "ExpiredToken" || 
      err?.message?.includes("ExpiredToken")
    ) {
      const refresh = await agent.com.atproto.server.refreshSession();
      accessJwt = refresh.data.accessJwt;
      refreshJwt = refresh.data.refreshJwt;
      console.log("[INFO] token was expired, so refreshed the session.");
    } else {
      console.error("[ERROR] unexpected error:", err);
      throw err;
    }
  }
}

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

export async function getGraphData(
  centerNodeHandle: string
): Promise<PageServerLoadOutput & { error?: string; status?: number }> {
  try {
    await createOrRefreshSession();
    const centerNodeProfile = await agent.resolveHandle({ handle: centerNodeHandle });
    const centerNodeDid = centerNodeProfile.data.did;

    const now = Date.now();
    const cachedData = graphDataCache[centerNodeDid]; // DIDをキーとして使用

    if (cachedData && now < cachedData.timestamp + CACHE_TTL) {
      console.log(`[INFO] Cache hit for ${centerNodeHandle} (DID: ${centerNodeDid})`);
      updateGraphDataCache(centerNodeHandle, centerNodeDid).catch((err) => {
        console.error(`[BACKGROUND] Failed to update cache for ${centerNodeHandle}:`, err);
      }); // 裏でキャッシュを更新, エラーはログに出すだけ
      return cachedData.data;
    }

    console.log(
      `[INFO] Cache miss or expired for ${centerNodeHandle} (DID: ${centerNodeDid}). Fetching new data.`
    );
    if (cachedData) {
      updateGraphDataCache(centerNodeHandle, centerNodeDid).catch((err) => {
        console.error(`[BACKGROUND] Failed to update cache for ${centerNodeHandle}:`, err);
      }); // 古いキャッシュを返しつつ、非同期で更新
      return cachedData.data;
    }

    return await updateGraphDataCache(centerNodeHandle, centerNodeDid); // キャッシュが存在しない場合はフェッチして返す
  } catch (error) {
    console.error(`Error in getGraphData for handle ${centerNodeHandle}:`, error);
    const emptyResult = {
      graphData: { nodes: [], edges: [] },
      initialCenterDid: ''
    };

    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      if (error.status === 400 && error.message.includes('Unable to resolve handle')) {
        return {
          ...emptyResult,
          error: `Handle not found: ${centerNodeHandle}`,
          status: 404
        };
      }
      return {
        ...emptyResult,
        error: error.message,
        status: error.status
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      ...emptyResult,
      error: errorMessage,
      status: 500
    };
  }
}

async function fetchAndProcessGraphData(centerNodeHandle: string, centerNodeDid: string): Promise<PageServerLoadOutput> {
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

    // createOrRefreshSessionはgetGraphDataの冒頭で呼び出されるため、ここでは不要
    // const centerNodeProfile = await agent.resolveHandle({handle: centerNodeHandle});
    // const centerNodeDid = centerNodeProfile.data.did;

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
    console.error('Error in fetchAndProcessGraphData function:', error);
    throw error;
  }
}

async function updateGraphDataCache(
  centerNodeHandle: string,
  centerNodeDid: string
): Promise<PageServerLoadOutput> {
  const data = await fetchAndProcessGraphData(centerNodeHandle, centerNodeDid);
  graphDataCache[centerNodeDid] = { // DIDをキーとして使用
    data,
    timestamp: Date.now(),
  };
  return data;
}

// expandGraph用のキャッシュ関数
export async function getExpandGraphData(didToExpand: string): Promise<any> {
  const now = Date.now();
  const cachedData = graphDataCache[didToExpand]; // 共通のキャッシュを使用

  if (cachedData && now < cachedData.timestamp + CACHE_TTL) {
    console.log(`[INFO] Common cache hit for expandGraph ${didToExpand}`);
    updateExpandGraphDataCache(didToExpand); // 裏でキャッシュを更新 (awaitを削除)
    return cachedData.data;
  }

  console.log(`[INFO] Common cache miss or expired for expandGraph ${didToExpand}. Fetching new data.`);
  if (cachedData) {
    updateExpandGraphDataCache(didToExpand); // 古いキャッシュを返しつつ、非同期で更新 (awaitを削除)
    return cachedData.data;
  }

  return await updateExpandGraphDataCache(didToExpand); // キャッシュが存在しない場合はフェッチして返す
}

async function fetchAndProcessExpandGraphData(didToExpand: string): Promise<any> { // 戻り値の型をanyに
  if (!BSKY_DID || !BSKY_PASSWORD) {
    console.error('Bluesky DID or password not set in environment variables.');
    return {
      graphData: {
        nodes: [],
        edges: [],
      },
      initialCenterDid: '', // PageServerLoadOutputとの互換性のため追加
      error: 'Server configuration error'
    };
  }

  await createOrRefreshSession();

  const relatedRecords = await fetchAllRecords(
    didToExpand,
    'com.skybemoreblue.intro.introduction'
  );
  console.log('Fetched relatedRecords count:', relatedRecords.length);

  const newDids = new Set<string>();
  relatedRecords.forEach((record: any) => {
    if (record.value?.subject) {
      newDids.add(record.value.subject);
    }
  });
  newDids.add(didToExpand);

  const profiles = await fetchAllProfiles(Array.from(newDids));

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
        tags: introduction ? introduction.tags : [],
      },
      group: 'nodes',
    });
  }

  relatedRecords.forEach((record: any) => {
    const sourceDid = record.uri.split('/')[2];
    const targetDid = record.value?.subject;

    if (targetDid && didToProfileMap.has(sourceDid) && didToProfileMap.has(targetDid)) {
      newEdges.push({
        data: {
          source: sourceDid,
          target: targetDid,
        },
        group: 'edges',
      });
    }
  });

  return {
    graphData: {
      nodes: newNodes,
      edges: newEdges,
    },
  };
}

async function updateExpandGraphDataCache(didToExpand: string) {
  const data = await fetchAndProcessExpandGraphData(didToExpand);
  graphDataCache[didToExpand] = { // 共通のキャッシュを使用
    data,
    timestamp: Date.now(),
  };
  return data;
}
