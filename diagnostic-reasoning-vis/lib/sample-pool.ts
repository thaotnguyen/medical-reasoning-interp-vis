// ============================================================
// Deterministic sample pool for human labeling
// Same seed → same cases for all raters on all devices
// ============================================================

export interface SampleItem {
  index: number;       // 0-based position in the pool
  model: string;
  dataset: string;
  caseIndex: number;   // index into the model_dataset.json array
  isTraining?: boolean;
}

/** Total test cases in the labeling pool (1 per model×dataset stratum) */
export const POOL_SIZE = 24;

/** Seed for deterministic sampling — do NOT change after study begins */
const SEED = 20260325;

/**
 * Hardcoded training cases — shown first in the sidebar for rater calibration.
 * Case 0: Claude 3.7 Sonnet, Case 1: QWQ 32B, Case 2: GPT OSS 20B
 */
export const TRAINING_CASES: Omit<SampleItem, "index">[] = [
  { model: "claude-3-7-sonnet-20250219", dataset: "medqa",            caseIndex: 0, isTraining: true },
  { model: "qwq-32b",                   dataset: "medmcqa-filtered",  caseIndex: 0, isTraining: true },
  { model: "gpt-oss-20b",               dataset: "nejm-cpc",          caseIndex: 0, isTraining: true },
];

/**
 * Mulberry32: simple 32-bit seeded PRNG.
 * Returns a function that yields [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using provided RNG */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Manual overrides for specific model×dataset strata.
 * Key: "{model}_{dataset}", value: forced caseIndex.
 * Use when the seeded selection yields a degenerate/error case.
 */
const POOL_OVERRIDES: Record<string, number> = {
  // Seeded selection (index 166) was a 5-sentence error trace; replaced with a
  // 25-sentence correct oligodendroglioma case (index 250).
  "deepseek-r1-distill-qwen-14b_nejm-cpc": 250,
};

/**
 * Build the 24 test cases: exactly 1 case per model×dataset stratum,
 * selected deterministically using SEED.
 */
export function buildSamplePool(
  modelOrder: string[],
  datasetOrder: string[],
  caseCounts: Record<string, Record<string, number>>
): SampleItem[] {
  const rng = mulberry32(SEED);
  const candidates: Omit<SampleItem, "index">[] = [];

  for (const model of modelOrder) {
    for (const dataset of datasetOrder) {
      const total = caseCounts[model]?.[dataset];
      if (!total) continue;
      const indices = Array.from({ length: total }, (_, i) => i);
      const shuffled = seededShuffle(indices, rng);
      const overrideKey = `${model}_${dataset}`;
      const caseIndex = POOL_OVERRIDES[overrideKey] ?? shuffled[0];
      candidates.push({ model, dataset, caseIndex });
    }
  }

  // Shuffle all candidates for randomized ordering, then take POOL_SIZE
  const shuffled = seededShuffle(candidates, rng);
  return shuffled.slice(0, POOL_SIZE).map((item, i) => ({ ...item, index: i }));
}

/**
 * Build the full pool: 3 training cases (indices 0–2) followed by
 * 24 test cases (indices 3–26).
 */
export function buildFullPool(
  modelOrder: string[],
  datasetOrder: string[],
  caseCounts: Record<string, Record<string, number>>
): SampleItem[] {
  const training = TRAINING_CASES.map((c, i) => ({ ...c, index: i }));
  const test = buildSamplePool(modelOrder, datasetOrder, caseCounts).map((c, i) => ({
    ...c,
    index: i + training.length,
  }));
  return [...training, ...test];
}
