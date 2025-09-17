<script lang="ts">
  import Graph from '../components/Graph.svelte';
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';

  export let data: PageData;
  let graphData = data.graphData;

  let initialCenterDid: string | null = data.initialCenterDid;
  let selectedNodeDid: string | null = data.initialCenterDid; // タップされたノード、初期値は中心ノード
  let hoveredNodeDid: string | null = null; // マウスオーバーされたノード
  let hoveredNodePosition: { x: number; y: number } | null = null; // マウスオーバーされたノードの描画位置

  // 表示する紹介文とツールチップのスタイルをリアクティブに計算
  $: displayIntroduction = '';
  $: tooltipStyle = 'display: none;';

  $: {
    displayIntroduction = '';
    tooltipStyle = 'display: none;';

    if (graphData && hoveredNodeDid) {
      const hoveredNode = graphData.nodes.find(node => node.data.id === hoveredNodeDid);
      if (hoveredNode && hoveredNode.data.introductions) {
        const authorDidToCheck = selectedNodeDid || initialCenterDid;
        const intro = hoveredNode.data.introductions.find(intro => intro.author === authorDidToCheck);

        if (intro && intro.body) {
          displayIntroduction = intro.body;
          if (hoveredNodePosition) {
            tooltipStyle = `
              display: block;
              left: ${hoveredNodePosition.x + 15}px;
              top: ${hoveredNodePosition.y + 15}px;
            `;
          }
        }
      }
    }
  }

  async function handleNodeTap(event: CustomEvent<{ did: string }>) {
    const did = event.detail.did;
    console.log('Node tapped:', did);

    selectedNodeDid = did; // タップされたノードを更新
    hoveredNodeDid = null; // タップしたらマウスオーバー状態をリセット
    hoveredNodePosition = null;

    if (!graphData || !graphData.nodes || !graphData.edges) {
      console.error('graphData is not properly initialized.');
      return;
    }

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
    }
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

<style>
  .tooltip {
    position: absolute;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px;
    border-radius: 4px;
    pointer-events: none; /* ツールチップがマウスイベントをブロックしないようにする */
    z-index: 1000;
    max-width: 300px; /* ツールチップの最大幅 */
    white-space: pre-wrap; /* 改行を保持 */
  }
</style>

<div class="container mx-auto p-4">
  <h1 class="text-3xl font-bold mb-4">GraphBeMoreBlue!</h1>
    {#if graphData}
      <Graph
        {graphData}
        on:nodeTap={handleNodeTap}
        on:nodeMouseover={handleNodeMouseover}
        on:nodeMouseout={handleNodeMouseout}
      />
      <div class="tooltip" style={tooltipStyle}>
        {displayIntroduction}
      </div>
    {:else}
      <p>Loading graph data...</p>
    {/if}
</div>
