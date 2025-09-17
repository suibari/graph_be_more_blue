<script lang="ts">
  import cytoscape from "cytoscape";
  import fcose from "cytoscape-fcose";
  import GraphStyles from './GraphStyles';
  import GraphLayout from './GraphLayout';
  import { onMount, createEventDispatcher } from "svelte";

  export let graphData: { nodes: any[]; edges: any[] };

  let container: HTMLDivElement;
  let cyInstance: cytoscape.Core | null = null;
  const dispatch = createEventDispatcher();

  // ツールチップの状態管理
  let tooltipContent: string = '';
  let tooltipStyle: string = 'display: none;';

  onMount(() => {
    cytoscape.use( fcose );

    cyInstance = cytoscape({
      container: container,
      elements: [...graphData.nodes, ...graphData.edges],
      style: GraphStyles,
      wheelSensitivity: 0.1,
    });

    // 相互フォロー関係にあるエッジにクラスを付与
    cyInstance.edges().forEach(edge => {
      const source = edge.source().id();
      const target = edge.target().id();
      const isMutual = edge.cy().edges(`[source = "${target}"][target = "${source}"]`).length > 0;
      if (isMutual) {
        edge.addClass('mutual');
      }
    });

    // 中心ノードを選択状態にする
    const centerNode = cyInstance.nodes('[id = "did:plc:ragtjsm2j2vryqud6e3f5n2c"]');
    if (centerNode.length > 0) {
      centerNode.select();
    }

    // 初期ロード時にレイアウトを適用
    cyInstance.layout(GraphLayout).run();

    // ------
    // イベントリスナー
    // ------
    cyInstance.on('add', () => {
      if (!cyInstance) return;
      cyInstance
        .layout(GraphLayout)
        .run()
    });

    cyInstance.on('tap', 'node', (evt) => {
      if (!cyInstance) return;
      const node = evt.target;
      cyInstance.nodes().unselect();
      node.select();
      dispatch('nodeTap', { did: node.id() });
    });

    // マウスオーバーイベント
    cyInstance.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      dispatch('nodeMouseover', { did: node.id(), renderedPosition: node.renderedPosition() });
    });

    // マウスアウトイベント
    cyInstance.on('mouseout', 'node', () => {
      dispatch('nodeMouseout');
    });
  })

  $: if (cyInstance && graphData) {
    // 既存の要素と新しい要素をマージ
    const currentElements = cyInstance.elements().jsons();
    const newElements = [...graphData.nodes, ...graphData.edges];

    // 新しい要素のみを追加するために、既存のIDを追跡
    const existingIds = new Set(currentElements.map(el => el.data.id));
    // 新しい要素のみを追加
    const elementsToAdd = newElements.filter(el => !existingIds.has(el.data.id));
    if (elementsToAdd.length > 0) {
      cyInstance.add(elementsToAdd);
      // 相互フォロー関係にあるエッジにクラスを付与
      cyInstance.edges().forEach(edge => {
        const source = edge.source().id();
        const target = edge.target().id();
        const isMutual = edge.cy().edges(`[source = "${target}"][target = "${source}"]`).length > 0;
        if (isMutual) {
          edge.addClass('mutual');
        }
      });
    }

    // graphDataが変更されたら常にレイアウトを再適用
    cyInstance.layout(GraphLayout).run();
  }
</script>

<style>
  .graph {
    width: 100%;
    height: 80vh; /* 画面の高さの80%を使用 */
    border: 1px solid #ccc;
    position: relative; /* ツールチップの配置のために必要 */
  }

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

<div class="graph" bind:this={container}>
  {#if cyInstance}
    <slot/>
  {/if}
</div>
