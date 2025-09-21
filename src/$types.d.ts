
export type Introduction = {
  body: string;
  lang: string;
  tags: string[];
  $type: string;
  subject: string;
  authorDid: string; // authorDid を追加
  createdAt: string;
  updatedAt: string;
  author: string; // 既存の author も残しておく
};

export type GraphNode = {
  data: {
    id: string;
    img: string | null;
    name: string;
    rank: number;
    handle: string;
    introductions: Introduction[];
    tags?: string[];
  };
  group: 'nodes';
};

export type GraphEdge = {
  data: {
    source: string;
    target: string;
  };
  group: 'edges';
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type PageServerLoadOutput = {
  graphData: GraphData;
  initialCenterDid: string;
};
