import type { ServerLoad } from '@sveltejs/kit';
import { getGraphData } from '$lib/server/graphService';
import type { PageServerLoadOutput } from '../../../$types';

export const load: ServerLoad = async ({ params }): Promise<PageServerLoadOutput> => {
  const centerNodeHandle = params.handle as string; // params.handleはstring型であることを保証
  return getGraphData(centerNodeHandle);
};
