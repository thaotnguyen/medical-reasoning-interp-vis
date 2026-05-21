#!/usr/bin/env node
// Sample 100 cases deterministically across all geometric models.
// Output: public/data/pipelines/geometric/labeler-pool.json
import fs from "node:fs";
import path from "node:path";

const POOL_SIZE = 100;
const SEED = 20260520;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const casesDir = path.join(root, "public/data/pipelines/geometric/cases");
const outPath = path.join(root, "public/data/pipelines/geometric/labeler-pool.json");

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

const models = fs
  .readdirSync(casesDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

const candidates = [];
for (const model of models) {
  const cases = JSON.parse(
    fs.readFileSync(path.join(casesDir, `${model}.json`), "utf8")
  );
  cases.forEach((c, caseIndex) => {
    candidates.push({
      model,
      caseIndex,
      caseId: c.id,
      sentenceCount: Array.isArray(c.sentences) ? c.sentences.length : 0,
    });
  });
}

const rng = mulberry32(SEED);
// Guarantee at least one per model, then fill randomly from the rest.
const guaranteed = [];
const remaining = [];
for (const model of models) {
  const pool = candidates.filter((c) => c.model === model);
  const shuffled = seededShuffle(pool, rng);
  guaranteed.push(shuffled[0]);
  remaining.push(...shuffled.slice(1));
}
const extras = seededShuffle(remaining, rng).slice(
  0,
  Math.max(POOL_SIZE - guaranteed.length, 0)
);
const pool = seededShuffle([...guaranteed, ...extras], rng).map(
  (item, index) => ({ ...item, index })
);

fs.writeFileSync(outPath, JSON.stringify(pool, null, 2));
console.log(
  `wrote ${pool.length} pool items across ${models.length} models → ${outPath}`
);
