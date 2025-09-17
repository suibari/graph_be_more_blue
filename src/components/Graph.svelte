<script lang="ts">
  import cytoscape from "cytoscape";
  import fcose from "cytoscape-fcose";
  import GraphStyles from './GraphStyles';
  import GraphLayout from './GraphLayout';
  import { onMount, createEventDispatcher } from "svelte";
  import type { NodeDataDefinition } from "cytoscape";

  export let graphData: { nodes: any[]; edges: any[] };
  export let minMembersPerTag = 3;
  export let initialSelectedNodeDid: string | null = null; // 初期選択ノードのDIDを追加
  export let isLoading: boolean = false; // ローディング状態を追加

  let container: HTMLDivElement;
  let cyInstance: cytoscape.Core | null = null;
  const dispatch = createEventDispatcher();

  // ツールチップの状態管理 (Graph.svelteでは直接管理しないため削除)
  // let tooltipContent: string = '';
  // let tooltipStyle: string = 'display: none;';

  onMount(() => {
    cytoscape.use( fcose );

    const processedElements = processGraphData(graphData);

    cyInstance = cytoscape({
      container: container,
      elements: processedElements,
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

    // 初期中心ノードを選択状態にする
    if (initialSelectedNodeDid) {
      const centerNode = cyInstance.nodes(`[id = "${initialSelectedNodeDid}"]`);
      if (centerNode.length > 0) {
        centerNode.select();
      }
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
    const processedElements = processGraphData(graphData);
    // 既存の要素と新しい要素をマージ
    const currentElements = cyInstance.elements().jsons();

    // 新しい要素のみを追加するために、既存のIDを追跡
    const existingIds = new Set(currentElements.map(el => el.data.id));
    // 新しい要素のみを追加
    const elementsToAdd = processedElements.filter(el => !existingIds.has(el.data.id));

    if (elementsToAdd.length > 0) {
      cyInstance.add(elementsToAdd);
    }

    // 既存ノードのparentプロパティを更新
    processedElements.forEach(processedEl => {
      if (processedEl.group === 'nodes' && existingIds.has(processedEl.data.id)) {
        const currentCyNode = cyInstance?.getElementById(processedEl.data.id);
        if (currentCyNode && currentCyNode.data('parent') !== processedEl.data.parent) {
          currentCyNode.data('parent', processedEl.data.parent);
        }
      }
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

    // graphDataが変更されたら常にレイアウトを再適用
    cyInstance.layout(GraphLayout).run();

    // graphDataが更新された際にも、もし選択中のノードがなければ初期選択ノードを選択状態にする
    // ただし、これはノードタップ時の選択解除と競合する可能性があるため、ここでは削除
    // if (initialSelectedNodeDid && cyInstance.nodes(':selected').empty()) {
    //   const centerNode = cyInstance.nodes(`[id = "${initialSelectedNodeDid}"]`);
    //   if (centerNode.length > 0) {
    //     centerNode.select();
    //   }
    // }
  }

  const processGraphData = (data: { nodes: any[]; edges: any[] }) => {
    const nodes = data.nodes.map(n => ({...n})); // copy
    const edges = data.edges.map(e => ({...e})); // copy

    const tagCounts: Record<string, number> = {};
    nodes.forEach(node => {
      if (node.data.tags && node.data.tags.length > 0) {
        console.log(`Node ${node.data.id} (${node.data.name}) has tags:`, node.data.tags);
        node.data.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    console.log('Tag Counts:', tagCounts);

    const validTags = new Set(
      Object.entries(tagCounts)
        .filter(([, count]) => count >= minMembersPerTag)
        .map(([tag]) => tag)
    );
    console.log('Valid Tags (minMembersPerTag =', minMembersPerTag, '):', Array.from(validTags));

    const parentCandidates: Record<string, string | undefined> = {};
    nodes.forEach(node => {
      if (node.data.tags) {
        const foundTag = node.data.tags.find((tag: string) => validTags.has(tag));
        if (foundTag) {
          parentCandidates[node.data.id] = 'tag-' + foundTag;
        }
      }
    });

    const actualParentTagCounts: Record<string, number> = {};
    Object.values(parentCandidates).forEach(parentId => {
      if (parentId) {
        actualParentTagCounts[parentId] = (actualParentTagCounts[parentId] || 0) + 1;
      }
    });
    console.log('Actual Parent Tag Counts:', actualParentTagCounts);

    const finalParentNodes: { group: 'nodes', data: NodeDataDefinition, classes: string }[] = [];
    Object.entries(actualParentTagCounts).forEach(([parentId, count]) => {
      if (count >= minMembersPerTag) {
        finalParentNodes.push({
          group: 'nodes',
          data: { id: parentId, name: parentId.replace('tag-', '') },
          classes: 'parent'
        });
      }
    });

    nodes.forEach(node => {
      const parentId = parentCandidates[node.data.id];
      if (parentId && actualParentTagCounts[parentId] >= minMembersPerTag) {
        node.data.parent = parentId;
      } else {
        // 親ノードの条件を満たさない場合はparentを削除
        delete node.data.parent;
      }
    });

    return [...nodes, ...edges, ...finalParentNodes];
  }
</script>

<style>
  .graph {
    width: 100%;
    height: 100vh; /* 画面の高さの100%を使用 */
    /* border: 1px solid #ccc; */ /* 枠線を削除 */
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

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1001;
  }

  .loading-spinner {
    border: 8px solid #f3f3f3; /* Light grey */
    border-top: 8px solid #3498db; /* Blue */
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>

<div class="graph" bind:this={container}>
  {#if isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
  {/if}
  {#if cyInstance}
    <slot/>
  {/if}
</div>
