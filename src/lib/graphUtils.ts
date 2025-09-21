import type { GraphData, GraphNode, GraphEdge } from '$lib/types';

/**
 * グラフデータを拡張する共通関数
 * @param did タップされたノードのDID
 * @param currentGraphData 現在のグラフデータ
 * @returns 更新されたグラフデータと、表示すべきスナックバーのメッセージ（もしあれば）
 */
export async function expandGraph(
  did: string,
  currentGraphData: GraphData
): Promise<{ updatedGraphData: GraphData | null; snackbar?: { message: string; type: 'info' | 'error' } }> {
  const response = await fetch('/expandGraph', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ did })
  });

  if (!response.ok) {
    console.error('Failed to expand graph:', response.statusText);
    return { updatedGraphData: null, snackbar: { message: 'サーバーエラーが発生しました。', type: 'error' } };
  }

  const newGraphData = await response.json();
  console.log('New graph data received:', newGraphData);

  const existingNodeIds = new Set(currentGraphData.nodes.map((node) => node.data.id));
  const existingEdgeIds = new Set(currentGraphData.edges.map((edge) => `${edge.data.source}-${edge.data.target}`));

  const nodesToAdd = newGraphData.graphData.nodes.filter((node: GraphNode) => !existingNodeIds.has(node.data.id));
  const edgesToAdd = newGraphData.graphData.edges.filter(
    (edge: GraphEdge) => !existingEdgeIds.has(`${edge.data.source}-${edge.data.target}`)
  );

  let introductionsUpdated = false;
  let edgesUpdated = false;

  const updatedNodes = currentGraphData.nodes.map((node: GraphNode) => {
    const newNodeData = newGraphData.graphData.nodes.find((n: GraphNode) => n.data.id === node.data.id);
    if (newNodeData) {
      const existingIntros = node.data.introductions || [];
      const newIntros = newNodeData.data.introductions || [];
      const combinedIntros = [...existingIntros];

      newIntros.forEach((newIntro: any) => {
        if (!existingIntros.some((existingIntro: any) => existingIntro.author === newIntro.author && existingIntro.subject === newIntro.subject)) {
          combinedIntros.push(newIntro);
          introductionsUpdated = true;
        }
      });

      return { ...node, data: { ...node.data, ...newNodeData.data, introductions: combinedIntros } };
    }
    return node;
  });

  const updatedEdges = currentGraphData.edges.map((edge) => {
    const newEdgeData = newGraphData.graphData.edges.find(
      (e: any) => e.data.source === edge.data.source && e.data.target === edge.data.target
    );
    if (newEdgeData) {
      if (JSON.stringify(edge.data) !== JSON.stringify(newEdgeData.data)) {
        edgesUpdated = true;
        return { ...edge, data: { ...edge.data, ...newEdgeData.data } };
      }
    }
    return edge;
  });

  if (edgesToAdd.length > 0) {
    edgesUpdated = true;
  }

  if (nodesToAdd.length === 0 && edgesToAdd.length === 0 && !introductionsUpdated && !edgesUpdated) {
    const tappedNode = currentGraphData.nodes.find((node: GraphNode) => node.data.id === did);
    const nodeName = tappedNode?.data.name || tappedNode?.data.handle || 'このユーザー';
    return { updatedGraphData: null, snackbar: { message: `${nodeName}さんはまだ誰も紹介していないみたい`, type: 'info' } };
  }

  let finalNodes = updatedNodes;
  let finalEdges = updatedEdges;

  if (nodesToAdd.length > 0 || edgesToAdd.length > 0) {
    finalNodes = [...updatedNodes, ...nodesToAdd];
    finalEdges = [...updatedEdges, ...edgesToAdd];
  }

  return { updatedGraphData: { nodes: finalNodes, edges: finalEdges } };
}
