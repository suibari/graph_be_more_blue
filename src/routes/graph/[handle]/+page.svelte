<script lang="ts">
  import Graph from '../../../components/Graph.svelte'; // パスを修正
  import Tooltip from '../../../components/Tooltip.svelte'; // Tooltipコンポーネントをインポート
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { showSnackbar } from '$lib/stores/snackbar';
  import type { GraphData, GraphEdge, GraphNode } from '$lib/types'; // GraphNode型をインポート

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

  async function handleNodeTap(event: CustomEvent<{ did: string; isTapped: boolean }>) {
    const { did, isTapped } = event.detail;
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
      const edgesToAdd = newGraphData.graphData.edges.filter((edge: GraphEdge) => !existingEdgeIds.has(`${edge.data.source}-${edge.data.target}`));

      let introductionsUpdated = false;
      let edgesUpdated = false; // エッジの更新を検出するフラグ

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
              introductionsUpdated = true; // 紹介文が更新されたことをマーク
            }
          });

          return { ...node, data: { ...node.data, ...newNodeData.data, introductions: combinedIntros } };
        }
        return node;
      });

      // 既存エッジの情報を更新するロジックを追加
      const updatedEdges = (graphData as GraphData).edges.map(edge => {
        const newEdgeData = newGraphData.graphData.edges.find((e: any) => e.data.source === edge.data.source && e.data.target === edge.data.target);
        if (newEdgeData) {
          // エッジのプロパティ（例: 太さ）が変更されたかを検出
          // ここでは単純に新しいデータがあれば更新とみなす
          if (JSON.stringify(edge.data) !== JSON.stringify(newEdgeData.data)) {
            edgesUpdated = true;
            return { ...edge, data: { ...edge.data, ...newEdgeData.data } };
          }
        }
        return edge;
      });

      // 新しいエッジが追加された場合も edgesUpdated を true にする
      if (edgesToAdd.length > 0) {
        edgesUpdated = true;
      }

      if (nodesToAdd.length === 0 && edgesToAdd.length === 0 && !introductionsUpdated && !edgesUpdated) {
        // ノード、エッジ、紹介文すべてに更新がない場合
        const tappedNode = graphData.nodes.find((node: GraphNode) => node.data.id === did);
        const nodeName = tappedNode?.data.name || tappedNode?.data.handle || 'このユーザー';
        showSnackbar(`${nodeName}さんはまだ誰も紹介していないみたい`, 'info');
        isLoading = false; // ロード終了
        return; // 変更がない場合はここで処理を終了
      }

      // ノードに変更がある場合、またはエッジに変更がある場合
      if (nodesToAdd.length > 0 || edgesToAdd.length > 0) {
        // 新しいノードとエッジを追加
        graphData.nodes = [...updatedNodes, ...nodesToAdd];
        graphData.edges = [...updatedEdges, ...edgesToAdd];
      } else if (introductionsUpdated || edgesUpdated) {
        // ノードの追加はないが、エッジまたは紹介文が更新された場合
        // 既存のノードとエッジを更新
        graphData.nodes = updatedNodes;
        graphData.edges = updatedEdges;
        // この場合、グラフ全体の再描画は行わないが、エッジの更新は反映される
        // スナックバーも表示しない
      }
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
