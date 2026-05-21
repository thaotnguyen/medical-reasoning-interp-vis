// Geometric labeler pool: 100 cases sampled deterministically across all
// 6 models. The pool is precomputed by scripts/generate-geometric-pool.mjs
// and lives at /data/pipelines/geometric/labeler-pool.json.

export interface ActivePoolItem {
  index: number;
  model: string;
  dataset: string; // always "geometric" (kept for ratings-store back-compat)
  caseIndex: number;
  isTraining?: boolean;
  caseId?: string;
  sentenceCount?: number;
}

export interface GeometricPoolEntry {
  index: number;
  model: string;
  caseIndex: number;
  caseId: string;
  sentenceCount: number;
}

export function poolEntriesToItems(
  entries: readonly GeometricPoolEntry[]
): ActivePoolItem[] {
  return entries.map((e) => ({
    index: e.index,
    model: e.model,
    dataset: "geometric",
    caseIndex: e.caseIndex,
    caseId: e.caseId,
    sentenceCount: e.sentenceCount,
  }));
}

// Legacy compatibility: agreement page imports `buildActiveLabelerPool`. With
// the geometric pipeline the pool is loaded asynchronously from JSON, so this
// shim returns an empty array — callers should consume the geometric pool via
// `useGeometricLabelerPool` instead.
export function buildActiveLabelerPool(): ActivePoolItem[] {
  return [];
}
