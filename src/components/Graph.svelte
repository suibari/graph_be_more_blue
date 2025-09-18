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
  let tappedNodeDids = new Set<string>(); // 一度でもタップされたノードのDIDを保持
  let currentSelectedNodeDid: string | null = null; // 現在選択されているノードのDIDを保持

  onMount(() => {
    cytoscape.use( fcose );

    const processedElements = processGraphData(graphData);

    cyInstance = cytoscape({
      container: container,
      elements: processedElements,
      style: GraphStyles,
      wheelSensitivity: 0.1,
    });

    // 初期中心ノードを選択状態にし、tappedNodeDidsとcurrentSelectedNodeDidを更新
    if (initialSelectedNodeDid) {
      tappedNodeDids.add(initialSelectedNodeDid);
      currentSelectedNodeDid = initialSelectedNodeDid;
      const centerNode = cyInstance.nodes(`[id = "${initialSelectedNodeDid}"]`);
      if (centerNode.length > 0) {
        centerNode.select();
        centerNode.addClass('tapped');
      }
    }
    // エッジのスタイルを初期設定
    updateEdgeStyles(cyInstance, currentSelectedNodeDid);

    // 初期ロード時にレイアウトを適用
    cyInstance.layout(GraphLayout).run();

    // ------
    // イベントリスナー
    // ------
    cyInstance.on('tap', 'node', (evt) => {
      if (!cyInstance) return;
      const node = evt.target;
      const nodeId = node.id();

      cyInstance.nodes().unselect();
      node.select();

      const isTappedBefore = tappedNodeDids.has(nodeId); // 以前にタップされたことがあるか

      // currentSelectedNodeDid を更新
      currentSelectedNodeDid = nodeId;

      // tappedNodeDids に追加 (一度タップされたノードは常に保持)
      if (!isTappedBefore) {
        tappedNodeDids.add(nodeId);
        node.addClass('tapped'); // 半透明にする
      }

      // ノードがタップされたらエッジスタイルを再計算
      updateEdgeStyles(cyInstance, currentSelectedNodeDid);

      dispatch('nodeTap', { did: nodeId, isTapped: isTappedBefore }); // isTapped を復元
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

    const nodesToAdd = elementsToAdd.filter(el => el.group === 'nodes');
    const edgesToAdd = elementsToAdd.filter(el => el.group === 'edges');

    if (nodesToAdd.length > 0 || edgesToAdd.length > 0) {
      cyInstance.add(elementsToAdd);
    }

    // 既存ノードのparentプロパティを更新
    processedElements.forEach(processedEl => {
      if (processedEl.group === 'nodes' && existingIds.has(processedEl.data.id)) {
        const currentCyNode = cyInstance?.getElementById(processedEl.data.id);
        if (currentCyNode) {
          // parentプロパティが変更された場合のみ更新
          if (currentCyNode.data('parent') !== processedEl.data.parent) {
            currentCyNode.data('parent', processedEl.data.parent);
          }
          // その他のノードデータも更新（例: introductionsの変更を反映）
          // ただし、Cytoscape.jsはdataオブジェクト全体を置き換えると再描画される可能性があるため、
          // 必要なプロパティのみを更新するように注意
          // 現状、introductionsはGraph.svelteでは直接描画に影響しないため、ここでは更新しない
        }
      }
    });

    // エッジのスタイルを更新
    updateEdgeStyles(cyInstance, currentSelectedNodeDid);

    // ノードが追加された場合のみレイアウトを再適用
    if (nodesToAdd.length > 0) {
      cyInstance.layout(GraphLayout).run();
    }

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

  // エッジのスタイルを更新する関数
  function updateEdgeStyles(cy: cytoscape.Core, selectedNodeDid: string | null) {
    cy.edges().removeClass('mutual tapped-mutual tapped-unilateral'); // 既存のクラスをすべて削除

    cy.edges().forEach(edge => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();

      const isMutual = cy.edges(`[source = "${targetId}"][target = "${sourceId}"]`).length > 0;
      const isConnectedToSelectedNode = selectedNodeDid && (sourceId === selectedNodeDid || targetId === selectedNodeDid);

      if (isConnectedToSelectedNode) {
        if (isMutual) {
          edge.addClass('tapped-mutual'); // タップノードから直接の紹介ノードかつ相互紹介：太い青線
        } else {
          edge.addClass('tapped-unilateral'); // タップノードから直接の紹介ノードかつ片方紹介：細い青線
        }
      } else {
        if (isMutual) {
          edge.addClass('mutual'); // タップノードとは無関係だが、相互紹介状態：太い黒線
        }
        // タップノードとは無関係だが、片方紹介状態：細い黒線 (デフォルトのエッジスタイルが適用される)
        // その他：細い黒線 (デフォルトのエッジスタイルが適用される)
      }
    });
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
