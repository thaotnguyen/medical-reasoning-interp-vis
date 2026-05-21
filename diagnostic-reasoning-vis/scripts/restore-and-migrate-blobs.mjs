#!/usr/bin/env node
/**
 * Step 1: Fetch current blobs to get rater names
 * Step 2: Restore ratings from ratings.json.bak (original 7-category)
 * Step 3: Remap to new 6-category scheme
 * Step 4: Upload back to Vercel Blob
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local
const envContent = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) {
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[match[1].trim()] = val;
  }
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) { console.error("No BLOB_READ_WRITE_TOKEN"); process.exit(1); }

const { list, put } = await import("@vercel/blob");

const REMAP = { 0: 0, 1: 1, 2: 1, 3: 4, 4: 2, 5: 3, 6: 5 };

function remapValue(v) {
  if (v === -1 || v === null || v === undefined) return v;
  return REMAP[v] ?? v;
}

function walkAndRemap(obj) {
  let count = 0;
  if (obj && typeof obj === "object" && "taxonomy" in obj && "timestamp" in obj) {
    obj.taxonomy = remapValue(obj.taxonomy);
    return 1;
  }
  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj)) count += walkAndRemap(val);
  }
  return count;
}

async function main() {
  console.log("=== Restore & Migrate Blob Ratings ===\n");

  // 1. Fetch current blobs to get rater names
  const { blobs } = await list({ prefix: "ratings/", token });
  const raterNames = {};

  for (const blob of blobs) {
    const raterId = blob.pathname.replace("ratings/", "").replace(".json", "");
    try {
      const res = await fetch(blob.url);
      const data = await res.json();
      raterNames[raterId] = data.name || raterId;
      console.log(`Found blob: ${raterId} (name: ${raterNames[raterId]})`);
      // Show current taxonomy values for debugging
      const taxVals = new Set();
      function checkVals(o) {
        if (o && typeof o === "object" && "taxonomy" in o && "timestamp" in o) { taxVals.add(o.taxonomy); return; }
        if (o && typeof o === "object") for (const v of Object.values(o)) checkVals(v);
      }
      checkVals(data);
      console.log(`  Current taxonomy values in blob: [${[...taxVals].sort((a,b)=>a-b).join(", ")}]`);
    } catch {
      raterNames[raterId] = raterId;
    }
  }

  // 2. Load pristine backup
  const backup = JSON.parse(fs.readFileSync(path.join(ROOT, "ratings.json.bak"), "utf8"));
  console.log(`\nLoaded backup with raters: ${Object.keys(backup).join(", ")}`);

  // 3. For each rater in backup, remap and upload
  for (const [raterId, ratings] of Object.entries(backup)) {
    const name = raterNames[raterId] || raterId;

    // Deep clone to avoid mutating backup
    const ratingsCopy = JSON.parse(JSON.stringify(ratings));

    // Show pre-remap values
    const preVals = new Set();
    function checkPre(o) {
      if (o && typeof o === "object" && "taxonomy" in o && "timestamp" in o) { preVals.add(o.taxonomy); return; }
      if (o && typeof o === "object") for (const v of Object.values(o)) checkPre(v);
    }
    checkPre(ratingsCopy);
    console.log(`\n${raterId} (${name}):`);
    console.log(`  Original taxonomy values: [${[...preVals].sort((a,b)=>a-b).join(", ")}]`);

    // Remap
    const count = walkAndRemap(ratingsCopy);

    // Show post-remap values
    const postVals = new Set();
    function checkPost(o) {
      if (o && typeof o === "object" && "taxonomy" in o && "timestamp" in o) { postVals.add(o.taxonomy); return; }
      if (o && typeof o === "object") for (const v of Object.values(o)) checkPost(v);
    }
    checkPost(ratingsCopy);
    console.log(`  Remapped ${count} ratings. New values: [${[...postVals].sort((a,b)=>a-b).join(", ")}]`);

    // Upload with { name, ratings } wrapper
    const payload = JSON.stringify({ name, ratings: ratingsCopy });
    await put(`ratings/${raterId}.json`, payload, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
    console.log(`  Uploaded to blob.`);
  }

  console.log("\nDone!");
}

main().catch((e) => { console.error(e); process.exit(1); });
