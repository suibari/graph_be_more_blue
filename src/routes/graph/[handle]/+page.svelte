<script lang="ts">
  import Graph from '../../../components/Graph.svelte'; // パスを修正
  import Tooltip from '../../../components/Tooltip.svelte'; // Tooltipコンポーネントをインポート
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { showSnackbar } from '$lib/stores/snackbar';
  import type { GraphData, GraphEdge, GraphNode } from '$lib/types'; // GraphNode型をインポート
  import { expandGraph } from '$lib/graphUtils';

  export let data: PageData;
  let graphData = data.graphData;

  onMount(() => {
    if (data.error) {
      showSnackbar(data.error, 'error');
    } else if (data.noIntroductionData) {
      const centerNode = graphData.nodes.find((node: GraphNode) => node.data.id === initialCenterDid);
      const nodeName = centerNode?.data.name || centerNode?.data.handle || 'このユーザー';
      showSnackbar(
        `${nodeName}さんはまだ誰も紹介していないみたい。Let's go SkyBeMoreBlue !!`,
        'info',
        { href: 'https://www.skybemoreblue.com/', text: 'skybemoreblue.com' }
      );
    }
  });

  let initialCenterDid: string | null = data.initialCenterDid;
  let selectedNodeDid: string | null = data.initialCenterDid; // タップされたノード、初期値は中心ノード
  let hoveredNodeDid: string | null = null; // マウスオーバーされたノード
  let hoveredNodePosition: { x: number; y: number } | null = null; // マウスオーバーされたノードの描画位置
  let isLoading = !graphData; // 初期ロード状態を追加
  let hideTooltipTimer: ReturnType<typeof setTimeout>;

  async function handleNodeTap(event: CustomEvent<{ did: string; isTapped: boolean }>) {
    const { did, isTapped } = event.detail;
    console.log('Node tapped:', did, 'Is already tapped:', isTapped);

    selectedNodeDid = did;
    hoveredNodeDid = null;
    hoveredNodePosition = null;

    if (!graphData) {
      console.error('graphData is not properly initialized.');
      return;
    }

    if (isTapped) {
      console.log('Already tapped node. Skipping server fetch.');
      return;
    }

    isLoading = true;
    const result = await expandGraph(did, graphData);
    isLoading = false;

    if (result.updatedGraphData) {
      graphData = result.updatedGraphData;
    }

    if (result.snackbar) {
      showSnackbar(result.snackbar.message, result.snackbar.type);
    }
  }

  function handleNodeMouseover(event: CustomEvent<{ did: string; renderedPosition: { x: number; y: number } }>) {
    clearTimeout(hideTooltipTimer);
    hoveredNodeDid = event.detail.did;
    hoveredNodePosition = event.detail.renderedPosition;
  }

  function handleNodeMouseout() {
    hideTooltipTimer = setTimeout(() => {
      hoveredNodeDid = null;
      hoveredNodePosition = null;
    }, 100);
  }

  function handleTooltipEnter() {
    clearTimeout(hideTooltipTimer);
  }

  function handleTooltipLeave() {
    hoveredNodeDid = null;
    hoveredNodePosition = null;
  }
</script>

<div class="container mx-auto p-4">
  <Graph
    {graphData}
    initialSelectedNodeDid={initialCenterDid}
    {isLoading}
    on:nodeTap={handleNodeTap}
    on:nodeMouseover={handleNodeMouseover}
    on:nodeMouseout={handleNodeMouseout}
  />
  <Tooltip
    {graphData}
    {selectedNodeDid}
    {hoveredNodeDid}
    {hoveredNodePosition}
    {initialCenterDid}
    on:mouseenter={handleTooltipEnter}
    on:mouseleave={handleTooltipLeave}
  />
</div>
