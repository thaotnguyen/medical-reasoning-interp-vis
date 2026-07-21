import test from "node:test";
import assert from "node:assert/strict";

test("buildBlobFetchUrl appends a version query derived from blob metadata", async () => {
  const blobUrl = await import("../lib/blob-fetch-url.ts").catch(() => ({}));

  assert.equal(typeof blobUrl.buildBlobFetchUrl, "function");

  assert.equal(
    blobUrl.buildBlobFetchUrl({
      url: "https://example.com/ratings/kevin.json",
      etag: '"cd637e268494a5f95694288cf26c379a"',
      uploadedAt: "2026-04-08T01:56:10.000Z",
    }),
    "https://example.com/ratings/kevin.json?v=%22cd637e268494a5f95694288cf26c379a%22"
  );
});
