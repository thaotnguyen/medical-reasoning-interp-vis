#!/usr/bin/env node
/**
 * Reorder each pipeline's taxonomy states into the order they typically occur in a trace,
 * and recolor them so the palette runs in that same order.
 *
 * Rank key = mean normalised sentence position of a state across every trace of every model
 * in the pipeline (position j of n -> j/(n-1)), so a state that usually appears early ranks
 * before one that usually appears late. Ties are broken by the raw index for determinism.
 *
 * The state index is the join key for the whole dataset, so a permutation has to be applied
 * everywhere at once:
 *   - pipelines/<p>/taxonomy.json   states[] reordered, `color` reassigned by new rank
 *   - pipelines/<p>/cases/*.json    sentences[].t remapped
 *   - pipelines/<p>/points/*.json   point[2] (taxonomy_idx) remapped
 *   - ratings.json + backups/*.json human labels {"taxonomy": idx} remapped (dedup only:
 *                                   the labeler is pinned to the 6-model taxonomy)
 *
 * Idempotent: rerunning finds the states already sorted and makes no change.
 *
 * Usage: node scripts/reorder-taxonomy-by-occurrence.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data", "pipelines");
const DRY = process.argv.includes("--dry-run");

// Mirrors TAXONOMY_COLORS in lib/constants.ts; new rank i gets PALETTE[i].
const PALETTE = [
  "#9467bd", "#ff7f0e", "#1f77b4", "#e377c2", "#2ca02c", "#d62728",
  "#8c564b", "#17becf", "#bcbd22", "#7f7f7f", "#5b8def", "#e7969c",
];

// Only the pipelines the UI actually exposes (see PIPELINES in lib/constants.ts). The other
// dirs under public/data/pipelines are superseded experiments; leave them untouched.
const PIPELINES = ["dedup", "tenmodel"];

// Pipelines that the labeler/agreement pages read; their indices are referenced by ratings.
const RATED_PIPELINES = new Set(["dedup"]);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, v) => {
  if (DRY) return;
  fs.writeFileSync(p, JSON.stringify(v));
};

/** Mean normalised position of each state across all traces of a pipeline. */
function rankStates(pipeDir, K) {
  const total = new Array(K).fill(0);
  const count = new Array(K).fill(0);
  const casesDir = path.join(pipeDir, "cases");
  if (!fs.existsSync(casesDir)) return null;

  for (const f of fs.readdirSync(casesDir).filter((f) => f.endsWith(".json"))) {
    for (const c of readJson(path.join(casesDir, f))) {
      const sents = c.sentences ?? [];
      if (sents.length < 2) continue;
      const denom = sents.length - 1;
      for (let j = 0; j < sents.length; j++) {
        const t = sents[j].t;
        if (!Number.isInteger(t) || t < 0 || t >= K) continue;
        total[t] += j / denom;
        count[t] += 1;
      }
    }
  }
  const mean = total.map((s, i) => (count[i] ? s / count[i] : Number.POSITIVE_INFINITY));
  // order[newIdx] = oldIdx
  const order = [...mean.keys()].sort((a, b) => mean[a] - mean[b] || a - b);
  return { order, mean, count };
}

function remapCases(pipeDir, toNew) {
  const dir = path.join(pipeDir, "cases");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const p = path.join(dir, f);
    const cases = readJson(p);
    for (const c of cases) {
      for (const s of c.sentences ?? []) {
        if (Number.isInteger(s.t) && toNew[s.t] !== undefined) s.t = toNew[s.t];
      }
    }
    writeJson(p, cases);
  }
}

function remapPoints(pipeDir, toNew) {
  const dir = path.join(pipeDir, "points");
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const p = path.join(dir, f);
    const pts = readJson(p);
    for (const pt of pts) {
      if (Number.isInteger(pt[2]) && toNew[pt[2]] !== undefined) pt[2] = toNew[pt[2]];
    }
    writeJson(p, pts);
  }
}

/** Recursively remap every {"taxonomy": <int>} field found in a ratings blob. */
function remapRatings(value, toNew, stats) {
  if (Array.isArray(value)) {
    for (const v of value) remapRatings(v, toNew, stats);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value)) {
    if (k === "taxonomy" && Number.isInteger(v)) {
      if (toNew[v] !== undefined) {
        value[k] = toNew[v];
        stats.remapped += 1;
      } else {
        stats.outOfRange += 1;
      }
    } else {
      remapRatings(v, toNew, stats);
    }
  }
}

function main() {
  const pipelines = PIPELINES.filter((p) =>
    fs.existsSync(path.join(DATA, p, "taxonomy.json"))
  );

  const permutations = {};
  for (const pipe of pipelines) {
    const pipeDir = path.join(DATA, pipe);
    const taxPath = path.join(pipeDir, "taxonomy.json");
    const tax = readJson(taxPath);
    const K = tax.states?.length ?? 0;
    if (!K) continue;

    const ranked = rankStates(pipeDir, K);
    if (!ranked) {
      console.log(`${pipe}: no cases/ — skipped`);
      continue;
    }
    const { order, mean, count } = ranked;
    const toNew = {};
    order.forEach((oldIdx, newIdx) => (toNew[oldIdx] = newIdx));
    permutations[pipe] = toNew;

    const identity = order.every((oldIdx, newIdx) => oldIdx === newIdx);
    console.log(`\n=== ${pipe}${identity ? "  (already ordered)" : ""}`);
    order.forEach((oldIdx, newIdx) => {
      const s = tax.states[oldIdx];
      console.log(
        `  ${oldIdx} -> ${newIdx}  mean_pos=${mean[oldIdx].toFixed(3)}  ` +
          `n=${String(count[oldIdx]).padStart(7)}  ${PALETTE[newIdx]}  ${s.label}`
      );
    });
    if (identity) continue;

    tax.states = order.map((oldIdx, newIdx) => ({
      ...tax.states[oldIdx],
      color: PALETTE[newIdx % PALETTE.length],
    }));
    writeJson(taxPath, tax);
    remapCases(pipeDir, toNew);
    remapPoints(pipeDir, toNew);
  }

  // Human labels are keyed to the pipeline the labeler is pinned to.
  const ratedPipe = [...RATED_PIPELINES].find((p) => permutations[p]);
  if (ratedPipe) {
    const toNew = permutations[ratedPipe];
    const targets = [
      path.join(ROOT, "ratings.json"),
      path.join(ROOT, "ratings.json.bak"),
      ...(fs.existsSync(path.join(ROOT, "backups"))
        ? fs
            .readdirSync(path.join(ROOT, "backups"))
            .filter((f) => f.endsWith(".json"))
            .map((f) => path.join(ROOT, "backups", f))
        : []),
    ].filter((p) => fs.existsSync(p));

    const K = Object.keys(toNew).length;
    console.log(`\n=== ratings (keyed to "${ratedPipe}", ${K} states)`);
    for (const p of targets) {
      const blob = readJson(p);

      // A permutation is only meaningful if the file's labels were written against THIS
      // taxonomy. Files carrying an index >= K belong to a superseded taxonomy with more
      // states (the historical backups here are all 7-state), and remapping their 0..K-1
      // values with this permutation would silently corrupt them rather than migrate them.
      const seen = { remapped: 0, outOfRange: 0 };
      remapRatings(structuredClone(blob), toNew, seen);
      if (seen.outOfRange) {
        console.log(
          `  ${path.relative(ROOT, p)}: SKIPPED — ${seen.outOfRange} label(s) index >= ${K}, ` +
            `so this file targets a different (larger) taxonomy`
        );
        continue;
      }

      const stats = { remapped: 0, outOfRange: 0 };
      remapRatings(blob, toNew, stats);
      if (stats.remapped) writeJson(p, blob);
      console.log(`  ${path.relative(ROOT, p)}: remapped ${stats.remapped}`);
    }
  }

  console.log(DRY ? "\n(dry run — nothing written)" : "\ndone");
}

main();
