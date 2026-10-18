// ============================================================
// Server-side labeling round: which ratings/<round>/ folder is live.
// The round is the name of the newest marker under ratings/rounds/, so it is
// read from a listing rather than from blob contents, which the CDN may cache.
// ============================================================

import { list, put } from "@vercel/blob";
import { FIRST_RATINGS_ROUND } from "./constants";

const MARKERS = "ratings/rounds/";

export async function currentRound(token: string): Promise<string> {
  const { blobs } = await list({ prefix: MARKERS, token });
  const rounds = blobs.map((b) => b.pathname.slice(MARKERS.length)).sort();
  return rounds.at(-1) ?? FIRST_RATINGS_ROUND;
}

/** Start a new round, named by its start time so that names sort in order. */
export async function startRound(token: string): Promise<string> {
  const round = new Date().toISOString().replace(/[:.]/g, "-");
  await put(`${MARKERS}${round}`, JSON.stringify({ round }), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    token,
  });
  return round;
}
