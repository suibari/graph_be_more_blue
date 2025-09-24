import type { ServerLoad } from '@sveltejs/kit';
import { getGraphData } from '$lib/server/graphService';
import type { PageServerLoadOutput } from '$lib/types';

export const load: ServerLoad = async ({ params }) => {
  const centerNodeHandle = params.handle as string;
  const resultPromise = getGraphData(centerNodeHandle);

  return {
    graphDataPromise: resultPromise.then(res => res.graphData),
    initialCenterDidPromise: resultPromise.then(res => res.initialCenterDid),
    errorPromise: resultPromise.then(res => res.error),
    statusPromise: resultPromise.then(res => res.status),
    noIntroductionDataPromise: resultPromise.then(res => {
      // グラフデータが存在し、かつノードが1つ（中心ノードのみ）で、そのノードに紹介文がない場合
      return res.graphData &&
             res.graphData.nodes.length === 1 &&
             (!res.graphData.nodes[0].data.introductions || res.graphData.nodes[0].data.introductions.length === 0);
    }),
  };
};
