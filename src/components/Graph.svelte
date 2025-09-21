<script lang="ts">
  import cytoscape from "cytoscape";
  import fcose from "cytoscape-fcose";
  import GraphStyles from './GraphStyles';
  import GraphLayout from './GraphLayout';
  import { onMount, createEventDispatcher } from "svelte";
  import type { NodeDataDefinition } from "cytoscape";

  export let graphData: { nodes: any[]; edges: any[] };
  export let minMembersPerTag = 2;
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
      wheelSensitivity: 0.5,
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

      // 親ノードはタップイベントを無視
      if (node.hasClass('parent')) {
        return;
      }

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

      dispatch('nodeTap', { did: nodeId, isTapped: isTappedBefore, renderedPosition: node.renderedPosition() }); // isTapped と renderedPosition を復元
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

    // 新しい親ノードのIDセットを作成
    const newParentNodeIds = new Set(
      processedElements
        .filter(el => el.group === 'nodes' && el.classes === 'parent')
        .map(el => el.data.id)
    );

    // 既存の親ノードのうち、新しいデータに含まれないものを削除
    cyInstance.nodes('.parent').forEach(parentCyNode => {
      if (!newParentNodeIds.has(parentCyNode.id())) {
        cyInstance?.remove(parentCyNode);
      }
    });

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

    // ノードが追加された場合、または親ノードが削除された場合にレイアウトを再適用
    if (nodesToAdd.length > 0 || cyInstance.nodes('.parent').length !== newParentNodeIds.size) { // 親ノードの数が変わった場合もレイアウトを適用
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
            node.data.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    const validTags = new Set(
      Object.entries(tagCounts)
        .filter(([, count]) => count >= minMembersPerTag)
        .map(([tag]) => tag)
    );

    // 各ノードに親を割り当てる
    nodes.forEach(node => {
      if (node.data.tags && node.data.tags.length > 0) {
        const candidateTags = node.data.tags.filter((tag: string) => validTags.has(tag));

        if (candidateTags.length > 0) {
          let selectedTag = candidateTags[0];
          let maxCount = tagCounts[selectedTag];

          for (let i = 1; i < candidateTags.length; i++) {
            const currentTag = candidateTags[i];
            const currentCount = tagCounts[currentTag];
            if (currentCount > maxCount) {
              maxCount = currentCount;
              selectedTag = currentTag;
            }
          }

          node.data.parent = 'tag-' + selectedTag;
        } else {
          delete node.data.parent;
        }
      } else {
        delete node.data.parent;
      }
    });

    // 実際に各親ノードに割り当てられた子ノードの数を再カウント
    const finalAssignedParentCounts: Record<string, number> = {};
    nodes.forEach(node => {
      if (node.data.parent) {
        finalAssignedParentCounts[node.data.parent] = (finalAssignedParentCounts[node.data.parent] || 0) + 1;
      }
    });

    // 最終的に残す親ノードのIDセット
    const finalValidParentIds = new Set<string>();
    Object.entries(finalAssignedParentCounts).forEach(([parentId, count]) => {
      if (count >= minMembersPerTag) {
        finalValidParentIds.add(parentId);
      }
    });

    // finalValidParentIds に含まれない親ノードに割り当てられた子ノードの parent プロパティを削除
    nodes.forEach(node => {
      if (node.data.parent && !finalValidParentIds.has(node.data.parent)) {
        delete node.data.parent;
      }
    });

    // 実際に子ノードが割り当てられ、かつ minMembersPerTag を満たす親ノードのみを生成
    const finalParentNodes: { group: 'nodes', data: NodeDataDefinition, classes: string }[] = [];
    finalValidParentIds.forEach(parentId => {
      finalParentNodes.push({
        group: 'nodes',
        data: { id: parentId, name: parentId.replace('tag-', '') },
        classes: 'parent'
      });
    });

    return [...nodes, ...edges, ...finalParentNodes];
  }

  // エッジのスタイルを更新する関数
  function updateEdgeStyles(cy: cytoscape.Core, selectedNodeDid: string | null) {
    cy.edges().removeClass('mutual tapped-mutual tapped-unilateral-outgoing'); // 既存のクラスをすべて削除

    cy.edges().forEach(edge => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();

      const isMutual = cy.edges(`[source = "${targetId}"][target = "${sourceId}"]`).length > 0;

      if (selectedNodeDid) {
        // ① タップノードから直接の紹介ノードかつ相互紹介：太い青線
        if (isMutual && (sourceId === selectedNodeDid || targetId === selectedNodeDid)) {
          edge.addClass('tapped-mutual');
        }
        // ② タップノードから直接の紹介ノードかつ片方紹介（タップノードから相手ノードに対してのみ）
        else if (!isMutual && sourceId === selectedNodeDid && targetId !== selectedNodeDid) {
          edge.addClass('tapped-unilateral-outgoing');
        }
        // ③ タップノードとは無関係だが、相互紹介状態：太い黒線
        else if (isMutual && sourceId !== selectedNodeDid && targetId !== selectedNodeDid) {
          edge.addClass('mutual');
        }
        // ④ その他：細い灰線 (デフォルトのエッジスタイルが適用される)
      } else {
        // タップノードが選択されていない場合
        if (isMutual) {
          edge.addClass('mutual'); // 相互紹介は太い黒線
        }
        // その他は細い灰線 (デフォルトのエッジスタイルが適用される)
      }
    });
  }
</script>

<!-- svelte-ignore css_unused_selector -->
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
