import type { ServerLoad } from '@sveltejs/kit';
import { getGraphData } from '$lib/server/graphService';
import type { PageServerLoadOutput } from '../$types';

export const load: ServerLoad = async (): Promise<PageServerLoadOutput> => {
  const centerNodeHandle = 'so-asano.com';
  return getGraphData(centerNodeHandle);
};
