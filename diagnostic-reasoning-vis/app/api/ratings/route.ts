import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

/**
 * GET /api/ratings - Fetch all raters' ratings from blob storage.
 * Returns: { [raterId]: { name, ratings } }
 */
export async function GET() {
  try {
    const { blobs } = await list({ prefix: "ratings/" });
    const allRatings: Record<string, { name: string; ratings: unknown }> = {};

    await Promise.all(
      blobs.map(async (blob) => {
        try {
          const response = await fetch(blob.url);
          const data = await response.json();
          const raterId = blob.pathname.replace("ratings/", "").replace(".json", "");
          allRatings[raterId] = data;
        } catch {
          // Skip corrupted blobs
        }
      })
    );

    return NextResponse.json(allRatings);
  } catch (e) {
    // Blob storage not configured or unavailable
    return NextResponse.json(
      { error: "Storage not configured. Set BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    );
  }
}

/**
 * POST /api/ratings - Upload a rater's ratings to blob storage.
 * Body: { raterId: string, name: string, ratings: object }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { raterId, name, ratings } = body;

    if (!raterId || !name || !ratings) {
      return NextResponse.json({ error: "Missing raterId, name, or ratings" }, { status: 400 });
    }

    const payload = JSON.stringify({ name, ratings });
    const blob = await put(`ratings/${raterId}.json`, payload, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });

    return NextResponse.json({ url: blob.url });
  } catch (e) {
    return NextResponse.json(
      { error: "Storage not configured. Set BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    );
  }
}
