<script lang="ts">
  import Graph from '../components/Graph.svelte';
  import Tooltip from '../components/Tooltip.svelte'; // Tooltipコンポーネントをインポート
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { showSnackbar } from '$lib/stores/snackbar';
  import type { GraphData, GraphNode } from '$lib/types'; // GraphNode型をインポート
  import { expandGraph } from '$lib/graphUtils';

  export let data: PageData; // data.graphDataPromise, data.errorPromise, data.statusPromise を含む

  let graphData: GraphData | null = null; // Promise解決後に設定される実際のグラフデータ
  let error: string | undefined = undefined;
  let status: number | undefined = undefined;

  onMount(() => {
    // errorPromise の解決を待ってスナックバーを表示
    data.errorPromise?.then(err => {
      if (err) {
        showSnackbar(err, 'error');
      }
    });

    // Promiseが解決されたら、実際のグラフデータを設定
    data.graphDataPromise?.then(resolvedGraphData => {
      graphData = resolvedGraphData || { nodes: [], edges: [] };
    });
  });

  let initialCenterDid: string | null = null;
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

    isLoading = true; // ここでローディングを開始
    const result = await expandGraph(did, graphData);
    isLoading = false; // ここでローディングを終了

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
  {#await data.graphDataPromise}
    <!-- Promiseが解決されるまでローディングサークルを表示 -->
    <Graph
      graphData={{ nodes: [], edges: [] }}
      initialSelectedNodeDid={initialCenterDid}
      isLoading={true}
      on:nodeTap={handleNodeTap}
      on:nodeMouseover={handleNodeMouseover}
      on:nodeMouseout={handleNodeMouseout}
    />
  {:then resolvedGraphData}
    <!-- Promiseが解決されたら、実際のグラフデータを設定し、Graphコンポーネントをレンダリング -->
    <Graph
      graphData={resolvedGraphData || { nodes: [], edges: [] }}
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
  {:catch err}
    <p>エラーが発生しました: {err.message}</p>
  {/await}
</div>
