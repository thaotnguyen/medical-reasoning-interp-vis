#!/usr/bin/env node
/**
 * Migrate taxonomy indices in local data files from 7-category to 6-category scheme.
 *
 * Old -> New: 0->0, 1->1, 2->1, 3->4, 4->2, 5->3, 6->5
 * -1 stays -1
 *
 * Migrates: case files (.t field), t-SNE files (point[2]), local ratings.json
 * Does NOT touch Vercel Blob — use restore-and-migrate-blobs.mjs for that.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REMAP = { 0: 0, 1: 1, 2: 1, 3: 4, 4: 2, 5: 3, 6: 5 };

function remapValue(v) {
  if (v === -1 || v === null || v === undefined) return v;
  const mapped = REMAP[v];
  if (mapped === undefined) {
    console.warn(`  WARNING: unexpected taxonomy value ${v}, leaving as-is`);
    return v;
  }
  return mapped;
}

// --- Case files ---
function migrateCaseFiles() {
  const casesDir = path.join(ROOT, "public/data/cases");
  const files = fs.readdirSync(casesDir).filter((f) => f.endsWith(".json"));
  console.log(`Migrating ${files.length} case files...`);

  let totalSentences = 0;
  for (const file of files) {
    const fp = path.join(casesDir, file);
    const cases = JSON.parse(fs.readFileSync(fp, "utf8"));
    for (const c of cases) {
      for (const sent of c.sentences) {
        sent.t = remapValue(sent.t);
        totalSentences++;
      }
    }
    fs.writeFileSync(fp, JSON.stringify(cases, null, 2) + "\n");
  }
  console.log(`  Remapped ${totalSentences} sentences across ${files.length} files.`);
}

// --- t-SNE files (flat array of TSNEPoints) ---
function migrateTSNEFiles() {
  const tsneDir = path.join(ROOT, "public/data/tsne");
  const files = fs.readdirSync(tsneDir).filter((f) => f.endsWith(".json"));
  console.log(`Migrating ${files.length} t-SNE files...`);

  let totalPoints = 0;
  for (const file of files) {
    const fp = path.join(tsneDir, file);
    const data = JSON.parse(fs.readFileSync(fp, "utf8"));
    for (const pt of data) {
      pt[2] = remapValue(pt[2]);
      totalPoints++;
    }
    fs.writeFileSync(fp, JSON.stringify(data) + "\n");
  }
  console.log(`  Remapped ${totalPoints} t-SNE points across ${files.length} files.`);
}

// --- Local ratings.json (restore from .bak then remap) ---
function migrateLocalRatings() {
  const bakPath = path.join(ROOT, "ratings.json.bak");
  const outPath = path.join(ROOT, "ratings.json");

  if (!fs.existsSync(bakPath)) {
    console.log("No ratings.json.bak found, skipping local ratings.");
    return;
  }

  const data = JSON.parse(fs.readFileSync(bakPath, "utf8"));
  let count = 0;

  function walk(obj) {
    if (obj && typeof obj === "object" && "taxonomy" in obj && "timestamp" in obj) {
      obj.taxonomy = remapValue(obj.taxonomy);
      count++;
      return;
    }
    if (obj && typeof obj === "object") {
      for (const val of Object.values(obj)) walk(val);
    }
  }

  walk(data);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`  Restored from .bak and remapped ${count} local ratings.`);
}

// --- Run ---
console.log("=== Taxonomy Migration: 7 categories -> 6 categories ===\n");
migrateCaseFiles();
console.log();
migrateTSNEFiles();
console.log();
migrateLocalRatings();
console.log("\nDone!");
