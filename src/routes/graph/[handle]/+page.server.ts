import type { ServerLoad } from '@sveltejs/kit';
import { getGraphData } from '$lib/server/graphService';
import type { PageServerLoadOutput } from '$lib/types';

export const load: ServerLoad = async ({
  params
}): Promise<PageServerLoadOutput & { noIntroductionData?: boolean; error?: string; status?: number }> => {
  const centerNodeHandle = params.handle as string; // params.handleはstring型であることを保証
  const result = await getGraphData(centerNodeHandle);

  // グラフデータが存在し、かつノードが1つ（中心ノードのみ）で、そのノードに紹介文がない場合
  const noIntroductionData = result.graphData &&
                             result.graphData.nodes.length === 1 &&
                             (!result.graphData.nodes[0].data.introductions || result.graphData.nodes[0].data.introductions.length === 0);

  return {
    ...result,
    noIntroductionData: noIntroductionData,
  };
};
