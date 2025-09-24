import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit'; // RequestEvent をインポート
import { BSKY_DID, BSKY_PASSWORD } from '$env/static/private';
import { getPds } from '$lib/server/getPds';
import { imageToBase64 } from '$lib/server/util';
import { agent, createOrRefreshSession, getRank, fetchAllRecords, fetchAllProfiles, getExpandGraphData } from '$lib/server/graphService';

export async function POST({ request }: RequestEvent) { // request に型を追加
  console.log('Expanding graph via API endpoint...');
  const { did: didToExpand } = await request.json();

  if (!didToExpand) {
    return json({ error: 'DID is required' }, { status: 400 });
  }

  if (!BSKY_DID || !BSKY_PASSWORD) {
    console.error('Bluesky DID or password not set in environment variables.');
    return json({ error: 'Server configuration error' }, { status: 500 });
  }

  const data = await getExpandGraphData(didToExpand); // 共通キャッシュ関数を使用
  return json(data);
}
