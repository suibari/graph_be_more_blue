import type { ServerLoad } from '@sveltejs/kit';
import { getGraphData, type PageServerLoadOutput } from '$lib/server/graphService';

export const load: ServerLoad = async (): Promise<PageServerLoadOutput> => {
  const centerNodeHandle = 'so-asano.com';
  return getGraphData(centerNodeHandle);
};
