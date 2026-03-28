import { put, list, del } from "@vercel/blob";
import { NextResponse } from "next/server";

const token = process.env.BLOB_READ_WRITE_TOKEN;

/**
 * GET /api/ratings - Fetch all raters' ratings from blob storage.
 * Returns: { [raterId]: { name, ratings } }
 */
export async function GET() {
  if (!token) {
    return NextResponse.json(
      { error: "Storage not configured. Set BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    );
  }

  try {
    const { blobs } = await list({ prefix: "ratings/", token });
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
    console.error("Blob GET error:", e);
    return NextResponse.json(
      { error: "Blob storage error", detail: String(e) },
      { status: 503 }
    );
  }
}

/**
 * POST /api/ratings - Upload a rater's ratings to blob storage.
 * Body: { raterId: string, name: string, ratings: object }
 */
export async function POST(request: Request) {
  if (!token) {
    return NextResponse.json(
      { error: "Storage not configured. Set BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    );
  }

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
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });

    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("Blob POST error:", e);
    return NextResponse.json(
      { error: "Blob storage error", detail: String(e) },
      { status: 503 }
    );
  }
}

/**
 * DELETE /api/ratings?raterId=xxx - Remove a rater's blob.
 */
export async function DELETE(request: Request) {
  if (!token) {
    return NextResponse.json(
      { error: "Storage not configured." },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const raterId = searchParams.get("raterId");
    if (!raterId) {
      return NextResponse.json({ error: "Missing raterId param" }, { status: 400 });
    }

    const { blobs } = await list({ prefix: `ratings/${raterId}.json`, token });
    if (blobs.length === 0) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    await del(blobs.map((b) => b.url), { token });
    return NextResponse.json({ deleted: raterId });
  } catch (e) {
    console.error("Blob DELETE error:", e);
    return NextResponse.json(
      { error: "Blob storage error", detail: String(e) },
      { status: 503 }
    );
  }
}
