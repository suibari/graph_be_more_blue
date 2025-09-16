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
import { getPds } from '$lib/getPds';

export const load: ServerLoad = async () => {
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
    console.log(record);
    if (record.value?.subject) { // subjectを使用
      initialDids.add(record.value.subject);
    }
  });
  initialDids.add(soAsanoDid); // so-asano.comのDIDをノードとして追加

  const visitedDids = new Set<string>();
  const didsToVisit = new Set<string>(initialDids);
  const allCollectedDids = new Set<string>();

  while (didsToVisit.size > 0) {
    const currentDid = didsToVisit.values().next().value as string; // 型アサーションを追加
    didsToVisit.delete(currentDid);
    if (visitedDids.has(currentDid)) {
      continue;
    }
    visitedDids.add(currentDid);
    allCollectedDids.add(currentDid);

    // ここでcurrentDidのレコードを収集し、そこから新しいDIDを抽出する
    // 例: currentDidがフォローしているユーザーのDIDを収集するなど
    // 今回は `com.skybemoreblue.intro.introduction` レコードの `did` フィールドを芋づる式に辿る
    const relatedRecords = await fetchAllRecords(
      currentDid,
      'com.skybemoreblue.intro.introduction'
    );
    relatedRecords.forEach((record: any) => {
      console.log(record);
      if (record.value?.subject && !visitedDids.has(record.value.subject)) { // subjectを使用
        didsToVisit.add(record.value.subject);
      }
    });
  }

  const profiles = await fetchAllProfiles(Array.from(allCollectedDids));

  const nodes: any[] = [];
  const edges: any[] = [];
  const didToProfileMap = new Map<string, any>();

  for (const profile of profiles) {
    didToProfileMap.set(profile.did, profile);
    const rank = getRank({
      followersCount: profile.followersCount || 0,
      followsCount: profile.followsCount || 1, // 0除算を避ける
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

  // エッジの生成
  // introRecordsはso-asano.comが発行したレコードなので、sourceはso-asano.comのDID
  introRecords.forEach((record: any) => {
    if (record.value?.subject && didToProfileMap.has(soAsanoDid) && didToProfileMap.has(record.value.subject)) {
      edges.push({
        data: {
          source: soAsanoDid, // so-asano.comのDIDを使用
          target: record.value.subject, // subjectを使用
        },
        group: 'edges',
      });
    }
  });

  // 芋づる式に収集したレコードからもエッジを生成
  for (const did of visitedDids) {
    const relatedRecords = await fetchAllRecords(
      did,
      'com.skybemoreblue.intro.introduction'
    );
    relatedRecords.forEach((record: any) => {
      // record.repoはレコードを発行したDID
      if (record.value?.subject && didToProfileMap.has(record.repo) && didToProfileMap.has(record.value.subject)) {
        edges.push({
          data: {
            source: record.repo,
            target: record.value.subject, // subjectを使用
          },
          group: 'edges',
        });
      }
    });
  }

  return {
    graphData: {
      nodes,
      edges,
    },
  };
};

async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.statusText}`);
      return null;
    }
    const blob = await response.blob();
    const base64data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return base64data;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}
