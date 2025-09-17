import type { ServerLoad } from '@sveltejs/kit';
import { getGraphData, type PageServerLoadOutput } from '$lib/server/graphService';

export const load: ServerLoad = async ({ params }): Promise<PageServerLoadOutput> => {
  const centerNodeHandle = params.handle as string; // params.handleはstring型であることを保証
  return getGraphData(centerNodeHandle);
};
