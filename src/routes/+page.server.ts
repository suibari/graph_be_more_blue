import type { ServerLoad } from '@sveltejs/kit';
import type { PageServerLoadOutput } from '../$types';
import { getRecentIntroductionsGraphData } from '$lib/server/graphService';

export const load: ServerLoad = async (): Promise<
  PageServerLoadOutput & { error?: string; status?: number }
> => {
  return getRecentIntroductionsGraphData();
};
