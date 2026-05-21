import { put, list, del } from "@vercel/blob";
import { readFileSync } from "fs";

// Strip quotes if present
const token = process.env.BLOB_READ_WRITE_TOKEN?.replace(/^"|"$/g, "");
if (!token) { console.error("No BLOB_READ_WRITE_TOKEN"); process.exit(1); }

const raterNames = { thao: "Thao", kevin: "Kevin", "matt-test": "Matt" };

// Read pristine backup
const ratings = JSON.parse(readFileSync("ratings.json.bak", "utf-8"));

// First, list and delete ALL existing rating blobs
console.log("Deleting existing blobs...");
const { blobs } = await list({ prefix: "ratings/", token });
if (blobs.length > 0) {
  await del(blobs.map(b => b.url), { token });
  console.log(`  Deleted ${blobs.length} blobs`);
} else {
  console.log("  No existing blobs found");
}

// Upload each rater
for (const [raterId, raterData] of Object.entries(ratings)) {
  const name = raterNames[raterId] || raterId;
  const payload = JSON.stringify({ name, ratings: raterData });
  
  // Show stats
  let count = 0;
  const vals = new Set();
  for (const models of Object.values(raterData)) {
    for (const datasets of Object.values(models)) {
      for (const cases of Object.values(datasets)) {
        for (const r of Object.values(cases)) {
          count++;
          vals.add(r.taxonomy);
        }
      }
    }
  }
  
  const blob = await put(`ratings/${raterId}.json`, payload, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token,
  });
  
  console.log(`Uploaded ${raterId}: ${count} labels, values=[${[...vals].sort()}], url=${blob.url}`);
}

// Verify
console.log("\nVerification - listing blobs:");
const { blobs: check } = await list({ prefix: "ratings/", token });
for (const b of check) {
  const res = await fetch(b.url);
  const data = await res.json();
  let count = 0;
  const vals = new Set();
  for (const models of Object.values(data.ratings || {})) {
    for (const datasets of Object.values(models)) {
      for (const cases of Object.values(datasets)) {
        for (const r of Object.values(cases)) {
          count++;
          vals.add(r.taxonomy);
        }
      }
    }
  }
  console.log(`  ${b.pathname}: ${count} labels, values=[${[...vals].sort()}]`);
}

console.log("\nDone! Blob ratings restored from ratings.json.bak (original 7-category format).");
