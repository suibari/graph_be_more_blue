<script lang="ts">
  import cytoscape from "cytoscape";
  import fcose from "cytoscape-fcose";
  import GraphStyles from './GraphStyles';
  import GraphLayout from './GraphLayout';
  import { onMount } from "svelte";

  export let elements: any[];

  let container: HTMLDivElement;
  let cyInstance: cytoscape.Core | null = null;

  onMount(() => {
    cytoscape.use( fcose );

    cyInstance = cytoscape({
      container: container,
      elements: elements,
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

  $: if (cyInstance && elements) {
    cyInstance.json({ elements: elements });
    cyInstance.layout(GraphLayout).run();
  }
</script>

<div class="graph" bind:this={container}>
  {#if cyInstance}
    <slot/>
  {/if}
</div>
