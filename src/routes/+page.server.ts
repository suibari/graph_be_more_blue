import type { ServerLoad } from '@sveltejs/kit';
import type { PageServerLoadOutput } from '$lib/types'; // $types から lib/types に変更
import { getRecentIntroductionsGraphData } from '$lib/server/graphService';

export const load: ServerLoad = async () => {
  const resultPromise = getRecentIntroductionsGraphData();
  return {
    graphDataPromise: resultPromise.then(res => res.graphData),
    errorPromise: resultPromise.then(res => res.error),
    statusPromise: resultPromise.then(res => res.status),
  };
};
