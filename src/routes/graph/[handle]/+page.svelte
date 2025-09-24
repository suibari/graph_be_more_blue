<script lang="ts">
  import Graph from '../../../components/Graph.svelte';
  import Tooltip from '../../../components/Tooltip.svelte';
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { showSnackbar } from '$lib/stores/snackbar';
  import type { GraphData, GraphEdge, GraphNode } from '$lib/types';
  import { expandGraph } from '$lib/graphUtils';

  export let data: PageData; // data.graphDataPromise, data.initialCenterDidPromise, data.errorPromise, data.statusPromise, data.noIntroductionDataPromise を含む

  let graphData: GraphData | null = null;
  let initialCenterDid: string | null = null;
  let error: string | undefined = undefined;
  let status: number | undefined = undefined;
  let noIntroductionData: boolean | undefined = undefined;

  onMount(() => {
    Promise.all([data.errorPromise, data.noIntroductionDataPromise, data.initialCenterDidPromise, data.graphDataPromise]).then(([err, noIntro, centerDid, resolvedGraphData]) => {
      if (err) {
        showSnackbar(err, 'error');
      } else if (noIntro) {
        const centerNode = resolvedGraphData?.nodes.find((node: GraphNode) => node.data.id === centerDid);
        const nodeName = centerNode?.data.name || centerNode?.data.handle || 'このユーザー';
        showSnackbar(
          `${nodeName}さんはまだ誰も紹介していないみたい。Let's go SkyBeMoreBlue !!`,
          'info',
          { href: 'https://www.skybemoreblue.com/', text: 'skybemoreblue.com' }
        );
      }

      // Promiseが解決されたら、実際のグラフデータを設定
      graphData = resolvedGraphData || { nodes: [], edges: [] };
      initialCenterDid = centerDid;
      selectedNodeDid = centerDid; // 初期選択ノードも設定
    });
  });

  // selectedNodeDid は onMount で設定されるため、ここでは初期値を null に戻す
  let selectedNodeDid: string | null = null;
  let hoveredNodeDid: string | null = null;
  let hoveredNodePosition: { x: number; y: number } | null = null;
  let isLoading: boolean = false; // handleNodeTap でのみ使用
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
  {#await Promise.all([data.graphDataPromise, data.initialCenterDidPromise])}
    <!-- Promiseが解決されるまでローディングサークルを表示 -->
    <Graph
      graphData={{ nodes: [], edges: [] }}
      initialSelectedNodeDid={null}
      isLoading={true}
      on:nodeTap={handleNodeTap}
      on:nodeMouseover={handleNodeMouseover}
      on:nodeMouseout={handleNodeMouseout}
    />
  {:then [resolvedGraphData, resolvedInitialCenterDid]}
    <!-- Promiseが解決されたら、実際のグラフデータを設定し、Graphコンポーネントをレンダリング -->
    <Graph
      graphData={resolvedGraphData || { nodes: [], edges: [] }}
      initialSelectedNodeDid={resolvedInitialCenterDid}
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
  {:catch err}
    <p>エラーが発生しました: {err.message}</p>
  {/await}
</div>
