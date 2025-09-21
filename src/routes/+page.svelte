<script lang="ts">
  import Graph from '../components/Graph.svelte';
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { showSnackbar } from '$lib/stores/snackbar';

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
  let isHoveringTooltip = false;
  let hideTooltipTimer: any;

  // 表示する紹介文とツールチップのスタイルをリアクティブに計算
  $: displayIntroduction = '';
  $: tooltipStyle = 'display: none;';

  $: {
    displayIntroduction = '';
    tooltipStyle = 'display: none;';

    let targetNodeDid = hoveredNodeDid || selectedNodeDid;

    if (graphData && targetNodeDid) {
      const targetNode = graphData.nodes.find(node => node.data.id === targetNodeDid);
      if (targetNode && targetNode.data.introductions) {
        // TOPページでは中心ノードの概念がないため、targetNodeDidがsubjectとなっている紹介文を探す
        const intro = targetNode.data.introductions.find(intro => intro.subject === targetNodeDid);

        if (intro && intro.body) {
          // アカウントのnameを太字で表示
          const nodeName = targetNode.data.name || targetNode.data.handle;
          const profileLink = `https://www.skybemoreblue.com/user/${targetNode.data.id}`;
          
          // 紹介者の名前を取得
          const authorNode = graphData.nodes.find(node => node.data.id === intro.authorDid); // intro.author を使用
          const authorName = authorNode ? (authorNode.data.name || authorNode.data.handle) : '不明なユーザー';
          
          displayIntroduction = `<strong><a href="${profileLink}" target="_blank" rel="noopener noreferrer">${nodeName}</a></strong>\n${intro.body}\n\n紹介者: ${authorName}`;
          
          // マウスオーバー時またはタップ時にツールチップ位置を更新
          if (hoveredNodePosition && hoveredNodeDid) {
            tooltipStyle = `
              display: block;
              left: ${hoveredNodePosition.x + 15}px;
              top: ${hoveredNodePosition.y + 15}px;
            `;
          } else if (selectedNodeDid && selectedNodePosition) { // タップされたノードの位置を使用
            tooltipStyle = `
              display: block;
              left: ${selectedNodePosition.x + 15}px;
              top: ${selectedNodePosition.y + 15}px;
            `;
          } else {
            tooltipStyle = 'display: none;';
          }
        }
      }
    }
  }

  let selectedNodePosition: { x: number; y: number } | null = null; // タップされたノードの描画位置

  async function handleNodeTap(event: CustomEvent<{ did: string; isTapped: boolean; renderedPosition: { x: number; y: number } }>) {
    const { did, isTapped, renderedPosition } = event.detail;
    console.log('Node tapped:', did, 'Is already tapped:', isTapped);

    selectedNodeDid = did; // タップされたノードを更新
    selectedNodePosition = renderedPosition; // タップされたノードの描画位置を更新
    hoveredNodeDid = null; // タップしたらマウスオーバー状態をリセット
    hoveredNodePosition = null;

    if (!graphData || !graphData.nodes || !graphData.edges) {
      console.error('graphData is not properly initialized.');
      return;
    }

    if (isTapped) {
      // 既にタップ済みのノードの場合、サーバーフェッチは行わない
      console.log('Already tapped node. Skipping server fetch.');
      // 紹介文の表示は$: displayIntroductionブロックで自動的に更新される
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

      const existingNodeIds = new Set(graphData.nodes.map(node => node.data.id));
      const existingEdgeIds = new Set(graphData.edges.map(edge => `${edge.data.source}-${edge.data.target}`));

      const nodesToAdd = newGraphData.graphData.nodes.filter((node: any) => !existingNodeIds.has(node.data.id));
      const edgesToAdd = newGraphData.graphData.edges.filter((edge: any) => !existingEdgeIds.has(`${edge.data.source}-${edge.data.target}`));

      if (nodesToAdd.length === 0 && edgesToAdd.length === 0) {
        const tappedNode = graphData.nodes.find(node => node.data.id === did);
        const nodeName = tappedNode?.data.name || tappedNode?.data.handle || 'このユーザー';
        showSnackbar(`${nodeName}さんはまだ誰も紹介していないみたい`, 'info');
        isLoading = false; // ロード終了
        return; // 変更がない場合はここで処理を終了
      }

      // 既存ノードの情報を更新するロジックを修正
      const updatedNodes = graphData.nodes.map(node => {
        const newNodeData = newGraphData.graphData.nodes.find((n: any) => n.data.id === node.data.id);
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
    clearTimeout(hideTooltipTimer);
    hoveredNodeDid = event.detail.did;
    hoveredNodePosition = event.detail.renderedPosition;
  }

  function handleNodeMouseout() {
    hideTooltipTimer = setTimeout(() => {
      if (!isHoveringTooltip) {
        hoveredNodeDid = null;
        hoveredNodePosition = null;
      }
    }, 100);
  }

  function handleTooltipEnter() {
    isHoveringTooltip = true;
    clearTimeout(hideTooltipTimer);
  }

  function handleTooltipLeave() {
    isHoveringTooltip = false;
    hoveredNodeDid = null;
    hoveredNodePosition = null;
  }
</script>

<style>
  .tooltip {
    position: absolute;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px;
    border-radius: 4px;
    z-index: 1000;
    max-width: 300px; /* ツールチップの最大幅 */
    white-space: pre-wrap; /* 改行を保持 */
  }
</style>

<div class="container mx-auto p-4">
  <Graph
    {graphData}
    initialSelectedNodeDid={initialCenterDid}
    {isLoading}
    on:nodeTap={handleNodeTap}
    on:nodeMouseover={handleNodeMouseover}
    on:nodeMouseout={handleNodeMouseout}
  />
  <div
    class="tooltip"
    style={tooltipStyle}
    on:mouseenter={handleTooltipEnter}
    on:mouseleave={handleTooltipLeave}
  >
    {@html displayIntroduction}
  </div>
</div>
