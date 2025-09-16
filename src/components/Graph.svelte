<script lang="ts">
  import cytoscape from "cytoscape";
  import fcose from "cytoscape-fcose";
  import GraphStyles from './GraphStyles';
  import GraphLayout from './GraphLayout';
  import { onMount } from "svelte";

  export let graphData: { nodes: any[]; edges: any[] };

  let container: HTMLDivElement;
  let cyInstance: cytoscape.Core | null = null;

  onMount(() => {
    cytoscape.use( fcose );

    cyInstance = cytoscape({
      container: container,
      elements: [...graphData.nodes, ...graphData.edges],
      style: GraphStyles,
      wheelSensitivity: 0.1,
    });

    // ------
    // イベントリスナー
    // ------
    cyInstance.on('add', () => {
      if (!cyInstance) return;
      cyInstance
        .layout(GraphLayout)
        .run()
    });
  })

  $: if (cyInstance && graphData) {
    cyInstance.json({ elements: [...graphData.nodes, ...graphData.edges] });
    cyInstance.layout(GraphLayout).run();
  }
</script>

<style>
  .graph {
    width: 100%;
    height: 80vh; /* 画面の高さの80%を使用 */
    border: 1px solid #ccc;
  }
</style>

<div class="graph" bind:this={container}>
  {#if cyInstance}
    <slot/>
  {/if}
</div>
