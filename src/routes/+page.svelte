<script lang="ts">
  import Graph from '../components/Graph.svelte'; // デフォルトインポートに戻す
  import type { PageData } from './$types';

  export let data: PageData;
  $: graphData = data.graphData;
</script>

<div class="container mx-auto p-4">
  <h1 class="text-3xl font-bold mb-4">Bluesky Graph</h1>
  {#if graphData}
    <Graph {graphData} />
  {:else}
    <p>Loading graph data...</p>
  {/if}
</div>
