import { put, list, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { currentRound } from "@/lib/ratings-round";

const token = process.env.BLOB_READ_WRITE_TOKEN;

/**
 * GET /api/ratings - Fetch all raters' ratings for the live round.
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
    const prefix = `ratings/${await currentRound(token)}/`;
    const { blobs } = await list({ prefix, token });
    const allRatings: Record<string, { name: string; ratings: unknown }> = {};

    await Promise.all(
      blobs.map(async (blob) => {
        try {
          const response = await fetch(blob.url);
          const data = await response.json();
          const raterId = blob.pathname.replace(prefix, "").replace(".json", "");
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
 * POST /api/ratings - Upload a rater's ratings for the live round.
 * Body: { raterId: string, name: string, ratings: object, round: string }
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
    const { raterId, name, ratings, round } = body;

    if (!raterId || !name || !ratings) {
      return NextResponse.json({ error: "Missing raterId, name, or ratings" }, { status: 400 });
    }

    // Ratings from an earlier round would undo a reset, so the client is told the live one.
    const live = await currentRound(token);
    if (round !== live) {
      return NextResponse.json({ error: "Stale round", round: live }, { status: 409 });
    }

    const payload = JSON.stringify({ name, ratings });
    const blob = await put(`ratings/${live}/${raterId}.json`, payload, {
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
 * DELETE /api/ratings?raterId=xxx - Remove a rater's ratings for the live round.
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

    const { blobs } = await list({ prefix: `ratings/${await currentRound(token)}/${raterId}.json`, token });
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
