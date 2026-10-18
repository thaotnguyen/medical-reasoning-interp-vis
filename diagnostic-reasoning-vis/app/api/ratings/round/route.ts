import { NextResponse } from "next/server";
import { currentRound, startRound } from "@/lib/ratings-round";

const token = process.env.BLOB_READ_WRITE_TOKEN;

/** GET /api/ratings/round - The live labeling round: { round }. */
export async function GET() {
  if (!token) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
  }
  try {
    return NextResponse.json({ round: await currentRound(token) });
  } catch (e) {
    return NextResponse.json({ error: "Blob storage error", detail: String(e) }, { status: 503 });
  }
}

/** POST /api/ratings/round - Start a new round for everyone: { round }. */
export async function POST() {
  if (!token) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
  }
  try {
    return NextResponse.json({ round: await startRound(token) });
  } catch (e) {
    return NextResponse.json({ error: "Blob storage error", detail: String(e) }, { status: 503 });
  }
}
