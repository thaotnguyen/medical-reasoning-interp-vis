// ============================================================
// Data types matching the preprocessed JSON files
// ============================================================

/** metadata.json top-level */
export interface Metadata {
  models: Record<string, ModelInfo>;
  datasets: Record<string, string>; // slug -> display name
  taxonomy: TaxonomyItem[];
  model_order: string[];
  dataset_order: string[];
}

export interface ModelInfo {
  display_name: string;
  has_activations: boolean;
  layer: number | null;
  num_clusters: number;
  clusters: Record<string, ClusterInfo>;
  datasets: Record<string, DatasetInfo>;
}

export interface ClusterInfo {
  title: string;
  description: string;
}

export interface DatasetInfo {
  display_name: string;
  has_tsne: boolean;
  num_cases: number;
}

export interface TaxonomyItem {
  label: string;
  color: string;
  short_name: string;
}

/** cases/{model}_{dataset}.json entry */
export interface Case {
  id: string;
  qid: number | null;
  prompt: string;
  true_dx: string;
  pred_dx: string;
  correct: boolean;
  sentences: Sentence[];
}

export interface Sentence {
  s: string;     // sentence text
  t: number;     // taxonomy index (0-6, or -1)
  c: string | null; // cluster id
  i: number;     // 1-based sentence index
  x: number | null; // t-SNE x
  y: number | null; // t-SNE y
}

/** tsne/{model}.json - flat array of tuples */
// [x, y, taxonomy_idx, cluster_id, case_idx, sent_idx]
export type TSNEPoint = [number, number, number, number, number, number];
