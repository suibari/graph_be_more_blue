<script lang="ts">
  import Graph from '../components/Graph.svelte';
  import Tooltip from '../components/Tooltip.svelte'; // Tooltipコンポーネントをインポート
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { showSnackbar } from '$lib/stores/snackbar';
  import type { GraphData, GraphNode } from '$lib/types'; // GraphNode型をインポート

  export let data: PageData;
  let graphData = data.graphData;

  onMount(() => {
    if (data.error) {
      showSnackbar(data.error, 'error');
    }
  });

  let initialCenterDid: string | null = null; // TOPページでは中心ノードは特定しない
  let selectedNodeDid: string | null = null; // タップされたノード、初期値は中心ノード
  let hoveredNodeDid: string | null = null; // マウスオーバーされたノード
  let hoveredNodePosition: { x: number; y: number } | null = null; // マウスオーバーされたノードの描画位置
  let isLoading = !graphData; // 初期ロード状態を追加

  async function handleNodeTap(event: CustomEvent<{ did: string; isTapped: boolean; renderedPosition: { x: number; y: number } }>) {
    const { did, isTapped } = event.detail; // renderedPosition は Tooltip コンポーネントに渡すため、ここでは不要
    console.log('Node tapped:', did, 'Is already tapped:', isTapped);

    selectedNodeDid = did; // タップされたノードを更新
    hoveredNodeDid = null; // タップしたらマウスオーバー状態をリセット
    hoveredNodePosition = null;

    if (!graphData || !graphData.nodes || !graphData.edges) {
      console.error('graphData is not properly initialized.');
      return;
    }

    if (isTapped) {
      console.log('Already tapped node. Skipping server fetch.');
      return;
    }

    isLoading = true; // ロード開始
    const response = await fetch('/expandGraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ did }),
    });

    if (response.ok) {
      const newGraphData = await response.json();
      console.log('New graph data received:', newGraphData);

      const existingNodeIds = new Set((graphData as GraphData).nodes.map(node => node.data.id));
      const existingEdgeIds = new Set((graphData as GraphData).edges.map(edge => `${edge.data.source}-${edge.data.target}`));

      const nodesToAdd = newGraphData.graphData.nodes.filter((node: GraphNode) => !existingNodeIds.has(node.data.id));
      const edgesToAdd = newGraphData.graphData.edges.filter((edge: any) => !existingEdgeIds.has(`${edge.data.source}-${edge.data.target}`));

      if (nodesToAdd.length === 0 && edgesToAdd.length === 0) {
        const tappedNode = graphData.nodes.find((node: GraphNode) => node.data.id === did);
        const nodeName = tappedNode?.data.name || tappedNode?.data.handle || 'このユーザー';
        showSnackbar(`${nodeName}さんはまだ誰も紹介していないみたい`, 'info');
        isLoading = false; // ロード終了
        return; // 変更がない場合はここで処理を終了
      }

      // 既存ノードの情報を更新するロジックを修正
      const updatedNodes = graphData.nodes.map((node: GraphNode) => {
        const newNodeData = newGraphData.graphData.nodes.find((n: GraphNode) => n.data.id === node.data.id);
        if (newNodeData) {
          // introductions 配列をマージする
          const existingIntros = node.data.introductions || [];
          const newIntros = newNodeData.data.introductions || [];
          const combinedIntros = [...existingIntros];

          newIntros.forEach((newIntro: any) => {
            // 重複を避ける（同じauthorとsubjectの紹介文は追加しない）
            if (!existingIntros.some((existingIntro: any) => existingIntro.author === newIntro.author && existingIntro.subject === newIntro.subject)) {
              combinedIntros.push(newIntro);
            }
          });

          return { ...node, data: { ...node.data, ...newNodeData.data, introductions: combinedIntros } };
        }
        return node;
      });

      graphData = {
        nodes: [...updatedNodes, ...nodesToAdd],
        edges: [...graphData.edges, ...edgesToAdd],
      };
    } else {
      console.error('Failed to expand graph:', response.statusText);
      showSnackbar('サーバーエラーが発生しました。', 'error');
    }
    isLoading = false; // ロード終了
  }

  function handleNodeMouseover(event: CustomEvent<{ did: string; renderedPosition: { x: number; y: number } }>) {
    hoveredNodeDid = event.detail.did;
    hoveredNodePosition = event.detail.renderedPosition;
  }

  function handleNodeMouseout() {
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
  />
</div>
