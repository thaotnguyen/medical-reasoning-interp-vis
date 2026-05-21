type BlobLike = {
  url: string;
  etag?: string | null;
  uploadedAt?: string | Date | null;
};

export function buildBlobFetchUrl(blob: BlobLike): string {
  const url = new URL(blob.url);
  const version =
    blob.etag ??
    (blob.uploadedAt instanceof Date ? blob.uploadedAt.toISOString() : blob.uploadedAt);

  if (version) {
    url.searchParams.set("v", version);
  }

  return url.toString();
}
