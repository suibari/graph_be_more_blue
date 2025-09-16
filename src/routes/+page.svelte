<script lang="ts">
  import Graph from '../components/Graph.svelte';
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  export let data: PageData;
  let graphData = data.graphData; // let に変更して更新可能にする

  async function handleNodeTap(event: CustomEvent<{ did: string }>) {
    const did = event.detail.did;
    console.log('Node tapped:', did);

    // graphDataがundefinedまたはnullの場合、処理を中断
    if (!graphData || !graphData.nodes || !graphData.edges) {
      console.error('graphData is not properly initialized.');
      return;
    }

    // APIエンドポイントを呼び出す
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

      // 既存のグラフデータに新しいノードとエッジをマージ
      const existingNodeIds = new Set(graphData.nodes.map(node => node.data.id));
      const existingEdgeIds = new Set(graphData.edges.map(edge => `${edge.data.source}-${edge.data.target}`));

      const nodesToAdd = newGraphData.graphData.nodes.filter((node: any) => !existingNodeIds.has(node.data.id));
      const edgesToAdd = newGraphData.graphData.edges.filter((edge: any) => !existingEdgeIds.has(`${edge.data.source}-${edge.data.target}`));

      graphData = {
        nodes: [...graphData.nodes, ...nodesToAdd],
        edges: [...graphData.edges, ...edgesToAdd],
      };
    } else {
      console.error('Failed to expand graph:', response.statusText);
    }
  }
</script>

<div class="container mx-auto p-4">
  <h1 class="text-3xl font-bold mb-4">Bluesky Graph</h1>
  {#if graphData}
    <Graph {graphData} on:nodeTap={handleNodeTap} />
  {:else}
    <p>Loading graph data...</p>
  {/if}
</div>
