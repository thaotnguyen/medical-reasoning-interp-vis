import type { Metadata } from "./types";

export interface ActivePoolItem {
  index: number;
  model: string;
  dataset: string;
  caseIndex: number;
  isTraining?: boolean;
}

const TRAINING_CASES: Array<Omit<ActivePoolItem, "index"> & { isTraining: true }> = [
  {
    model: "claude-3-7-sonnet-20250219",
    dataset: "medqa",
    caseIndex: 0,
    isTraining: true,
  },
  {
    model: "qwq-32b",
    dataset: "medmcqa-filtered",
    caseIndex: 0,
    isTraining: true,
  },
  {
    model: "gpt-oss-20b",
    dataset: "nejm-cpc",
    caseIndex: 0,
    isTraining: true,
  },
];

const TEST_POOL_SIZE = 100;
const TEST_POOL_SEED = 20260408;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildTestPool(metadata: Metadata): ActivePoolItem[] {
  const excludedTrainingKeys = new Set(
    TRAINING_CASES.map(
      (item) => `${item.model}_${item.dataset}_${item.caseIndex}`
    )
  );
  const rng = mulberry32(TEST_POOL_SEED);
  const guaranteedSelections: Omit<ActivePoolItem, "index">[] = [];
  const remainingCandidates: Omit<ActivePoolItem, "index">[] = [];

  for (const model of metadata.model_order) {
    for (const dataset of metadata.dataset_order) {
      const total = metadata.models[model]?.datasets?.[dataset]?.num_cases;
      if (!total) continue;

      const pairCandidates: Omit<ActivePoolItem, "index">[] = [];

      for (let caseIndex = 0; caseIndex < total; caseIndex++) {
        const key = `${model}_${dataset}_${caseIndex}`;
        if (excludedTrainingKeys.has(key)) continue;
        pairCandidates.push({ model, dataset, caseIndex });
      }

      if (pairCandidates.length === 0) continue;

      const shuffledPair = seededShuffle(pairCandidates, rng);
      guaranteedSelections.push(shuffledPair[0]);
      remainingCandidates.push(...shuffledPair.slice(1));
    }
  }

  const extraNeeded = Math.max(TEST_POOL_SIZE - guaranteedSelections.length, 0);
  const extras = seededShuffle(remainingCandidates, rng).slice(0, extraNeeded);

  return seededShuffle([...guaranteedSelections, ...extras], rng)
    .map((item, i) => ({
      ...item,
      index: i + TRAINING_CASES.length,
    }));
}

export function buildActiveLabelerPool(metadata: Metadata): ActivePoolItem[] {
  const training = TRAINING_CASES.map((item, index) => ({
    ...item,
    index,
  }));

  return [...training, ...buildTestPool(metadata)];
}
