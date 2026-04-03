/**
 * Compute sentence statistics for the 24-case test pool.
 *
 * Usage:
 *   node scripts/compute-sample-stats.mjs
 *
 * Must be run from the diagnostic-reasoning-vis directory.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ── Reproduce the seeded sample pool ────────────────────────────────────────

const SEED = 20260325;
const POOL_SIZE = 24;

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const POOL_OVERRIDES = {
  "deepseek-r1-distill-qwen-14b_nejm-cpc": 250,
};

function buildSamplePool(modelOrder, datasetOrder, caseCounts) {
  const rng = mulberry32(SEED);
  const candidates = [];
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
  const shuffled = seededShuffle(candidates, rng);
  return shuffled.slice(0, POOL_SIZE).map((item, i) => ({ ...item, index: i }));
}

// ── Load metadata ────────────────────────────────────────────────────────────

const metaPath = resolve("public/data/metadata.json");
const metadata = JSON.parse(readFileSync(metaPath, "utf8"));

const caseCounts = {};
for (const [model, info] of Object.entries(metadata.models)) {
  caseCounts[model] = {};
  for (const [dataset, dsInfo] of Object.entries(info.datasets)) {
    caseCounts[model][dataset] = dsInfo.num_cases;
  }
}

const pool = buildSamplePool(metadata.model_order, metadata.dataset_order, caseCounts);

// ── Load cases and compute stats ─────────────────────────────────────────────

const sentenceCounts = [];

for (const item of pool) {
  const casesPath = resolve(`public/data/cases/${item.model}_${item.dataset}.json`);
  const allCases = JSON.parse(readFileSync(casesPath, "utf8"));
  const c = allCases[item.caseIndex];
  if (!c) {
    console.warn(`  WARNING: case index ${item.caseIndex} not found in ${item.model}_${item.dataset}.json`);
    continue;
  }
  const n = c.sentences.length;
  sentenceCounts.push({ model: item.model, dataset: item.dataset, caseIndex: item.caseIndex, n });
}

// ── Print results ─────────────────────────────────────────────────────────────

const counts = sentenceCounts.map((x) => x.n);
const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
const min = Math.min(...counts);
const max = Math.max(...counts);
const sorted = [...counts].sort((a, b) => a - b);
const median = sorted.length % 2 === 0
  ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  : sorted[Math.floor(sorted.length / 2)];

console.log("\n=== Test Pool Sentence Statistics ===");
console.log(`Cases:   ${counts.length}`);
console.log(`Average: ${avg.toFixed(1)} sentences/transcript`);
console.log(`Median:  ${median}`);
console.log(`Min:     ${min}`);
console.log(`Max:     ${max}`);
console.log(`Range:   ${min}–${max}`);
console.log("\nPer-case breakdown:");
console.log("idx  model                          dataset            n");
console.log("---  -----------------------------  -----------------  ---");
sentenceCounts.forEach(({ model, dataset, caseIndex, n }, i) => {
  const m = model.padEnd(35);
  const d = dataset.padEnd(18);
  console.log(`${String(i + 3).padStart(3)}  ${m}${d}${n}`);
});
console.log();
