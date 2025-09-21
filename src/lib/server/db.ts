import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { GraphData } from '$lib/types';

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// テーブル名は 'graphs' とします
const TABLE_NAME = 'graphs';

/**
 * データベースに 'graphs' テーブルが存在しない場合に作成します。
 * Supabaseでは通常、ダッシュボードからテーブルを作成しますが、
 * 開発環境での利便性のため、コード上でも作成できるようにしておきます。
 * did: グラフの中心となるユーザーのDID (Decentralized Identifier)
 * graph_data: グラフのノードやエッジなどの情報を含むJSONオブジェクト
 * updated_at: データが最後に更新された時刻のタイムスタンプ
 */
export async function createTable() {
  // Supabaseでは通常、ダッシュボードからテーブルを作成します。
  // ここでは、テーブルが存在しない場合にエラーをログに出力するだけに留めます。
  // 実際のテーブル作成はSupabaseのUIまたはマイグレーションツールで行ってください。
  console.log(`[INFO] Please ensure the '${TABLE_NAME}' table exists in your Supabase project.`);
}

/**
 * 指定されたDIDのグラフデータをデータベースに保存または更新します。
 * @param did - 保存するグラフデータのDID
 * @param data - 保存するグラフデータ
 */
export async function saveGraphData(did: string, data: { graphData: GraphData; initialCenterDid: string }) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert({ did, graph_data: data, updated_at: new Date().toISOString() }, { onConflict: 'did' });

  if (error) {
    console.error('Error saving graph data:', error);
    throw error;
  }
}

/**
 * 指定されたDIDのグラフデータをデータベースから取得します。
 * @param did - 取得するグラフデータのDID
 * @returns データベースから取得したグラフデータとタイムスタンプ
 */
export async function getGraphData(did: string): Promise<{ data: { graphData: GraphData; initialCenterDid: string }; timestamp: Date } | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('graph_data, updated_at')
    .eq('did', did)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116はデータが見つからない場合のエラーコード
    console.error('Error fetching graph data:', error);
    throw error;
  }

  if (data) {
    return {
      data: data.graph_data as { graphData: GraphData; initialCenterDid: string },
      timestamp: new Date(data.updated_at),
    };
  }

  return null;
}
