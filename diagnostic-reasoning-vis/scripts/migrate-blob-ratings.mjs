#!/usr/bin/env node
/**
 * Migrate taxonomy indices in Vercel Blob-stored ratings from 7-category to 6-category scheme.
 * Uses @vercel/blob SDK. Reads BLOB_READ_WRITE_TOKEN from .env.local
 *
 * Old -> New: 0->0, 1->1, 2->1, 3->4, 4->2, 5->3, 6->5
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local into process.env
const envPath = path.join(ROOT, ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) {
    let val = match[2].trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[match[1].trim()] = val;
  }
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("BLOB_READ_WRITE_TOKEN not found in .env.local");
  process.exit(1);
}

// Dynamic import of @vercel/blob (installed in node_modules)
const { list, put } = await import("@vercel/blob");

const REMAP = { 0: 0, 1: 1, 2: 1, 3: 4, 4: 2, 5: 3, 6: 5 };

function remapValue(v) {
  if (v === -1 || v === null || v === undefined) return v;
  const mapped = REMAP[v];
  if (mapped === undefined) {
    console.warn(`  WARNING: unexpected taxonomy value ${v}`);
    return v;
  }
  return mapped;
}

function walkAndRemap(obj) {
  let count = 0;
  if (obj && typeof obj === "object" && "taxonomy" in obj && "timestamp" in obj) {
    obj.taxonomy = remapValue(obj.taxonomy);
    return 1;
  }
  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj)) {
      count += walkAndRemap(val);
    }
  }
  return count;
}

async function main() {
  console.log("=== Migrate Vercel Blob Ratings ===\n");

  const { blobs } = await list({ prefix: "ratings/", token });
  const ratingBlobs = blobs.filter((b) => b.pathname.startsWith("ratings/"));
  console.log(`Found ${ratingBlobs.length} rating blobs.\n`);

  for (const blob of ratingBlobs) {
    const raterId = blob.pathname.replace("ratings/", "").replace(".json", "");
    console.log(`Processing ${raterId}...`);

    // Fetch current data
    const dataRes = await fetch(blob.url);
    if (!dataRes.ok) {
      console.log(`  SKIP: failed to fetch (${dataRes.status})`);
      continue;
    }
    const data = await dataRes.json();

    // Remap
    const count = walkAndRemap(data.ratings || data);
    console.log(`  Remapped ${count} ratings.`);

    // Re-upload using @vercel/blob put
    await put(blob.pathname, JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
    console.log(`  Uploaded successfully.`);
  }

  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
