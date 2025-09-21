<script lang="ts">
  import type { GraphData, GraphNode, Introduction } from '$lib/types';
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let graphData: GraphData | null;
  export let selectedNodeDid: string | null = null;
  export let hoveredNodeDid: string | null = null;
  export let hoveredNodePosition: { x: number; y: number } | null = null;
  export let initialCenterDid: string | null = null; // graph/[handle]ページでのみ使用される可能性

  let displayIntroduction = '';
  let tooltipStyle = 'display: none;';
  const dispatch = createEventDispatcher();

  $: {
    displayIntroduction = '';
    tooltipStyle = 'display: none;';

    let targetNodeDid = hoveredNodeDid || selectedNodeDid;

    if (graphData && targetNodeDid) {
      const targetNode = graphData.nodes.find((node: GraphNode) => node.data.id === targetNodeDid);
      if (targetNode && targetNode.data.introductions) {
        let intro: Introduction | undefined;
        if (initialCenterDid) { // graph/[handle]ページの場合
          const authorDidToCheck = selectedNodeDid || initialCenterDid;
          intro = targetNode.data.introductions.find((i: Introduction) => i.author === authorDidToCheck);
        } else { // TOPページの場合
          intro = targetNode.data.introductions.find((i: Introduction) => i.subject === targetNodeDid);
        }

        if (intro && intro.body) {
          const nodeName = targetNode.data.name || targetNode.data.handle;
          const profileLink = `https://www.skybemoreblue.com/user/${targetNode.data.id}`;
          
          let authorName = '不明なユーザー';
          if (intro.authorDid) { // authorDidが存在する場合のみ検索
            const authorNode = graphData.nodes.find((node: GraphNode) => node.data.id === intro.authorDid);
            authorName = authorNode ? (authorNode.data.name || authorNode.data.handle) : '不明なユーザー';
          }
          
          displayIntroduction = `<strong><a href="${profileLink}" target="_blank" rel="noopener noreferrer">${nodeName}</a></strong>\n${intro.body}`;
          if (!initialCenterDid) { // TOPページの場合のみ紹介者を表示
            displayIntroduction += `\n\n紹介者: ${authorName}`;
          }
          
          if (hoveredNodePosition && hoveredNodeDid) {
            tooltipStyle = `
              display: block;
              left: ${hoveredNodePosition.x + 15}px;
              top: ${hoveredNodePosition.y + 15}px;
            `;
          } else if (selectedNodeDid && !hoveredNodeDid) {
            // タップされたノードの場合、ツールチップは非表示のまま、紹介文のみ更新
            // TOPページではselectedNodePositionを使用していたが、Tooltipコンポーネントに渡すのは複雑になるため、
            // ここではマウスオーバー時のみツールチップを表示するように統一する。
            // タップ時は紹介文のみ更新される。
            tooltipStyle = 'display: none;';
          }
        }
      }
    }
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
    max-width: 300px;
    white-space: pre-wrap;
  }
</style>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="tooltip"
  style={tooltipStyle}
  on:mouseenter={() => dispatch('mouseenter')}
  on:mouseleave={() => dispatch('mouseleave')}
>
  {@html displayIntroduction}
</div>
