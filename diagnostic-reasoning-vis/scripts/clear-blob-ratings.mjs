#!/usr/bin/env node
// Delete every rater's blob under ratings/ so Agreement starts empty.
// Requires BLOB_READ_WRITE_TOKEN in env.
import { list, del } from "@vercel/blob";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("BLOB_READ_WRITE_TOKEN not set");
  process.exit(1);
}

const { blobs } = await list({ prefix: "ratings/", token });
if (blobs.length === 0) {
  console.log("no ratings blobs found");
  process.exit(0);
}

console.log(`deleting ${blobs.length} rating blob(s):`);
for (const b of blobs) console.log("  -", b.pathname);

await del(
  blobs.map((b) => b.url),
  { token }
);
console.log("done");
