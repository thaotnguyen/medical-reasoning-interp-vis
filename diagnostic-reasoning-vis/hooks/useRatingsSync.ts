"use client";

import { useEffect, useRef, useCallback } from "react";
import type { RatingsStore, ServerRatingsResponse } from "@/lib/labeling-types";

interface UseRatingsSyncOptions {
  raterId: string | null;
  raterName: string | null;
  ratings: RatingsStore;
  enabled: boolean;
  onServerData?: (serverRatings: RatingsStore) => void;
}

/**
 * Debounced sync of local ratings to the server.
 * Syncs on:
 *  - Rating changes (debounced 3s)
 *  - Page visibility hidden (immediate)
 *  - Before unload (immediate, best-effort)
 */
export function useRatingsSync({
  raterId,
  raterName,
  ratings,
  enabled,
  onServerData,
}: UseRatingsSyncOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef = useRef<string>("");
  const hasPulledRef = useRef(false);

  // Pull server ratings on first mount when rater is identified
  useEffect(() => {
    if (!enabled || !raterId || hasPulledRef.current) return;
    hasPulledRef.current = true;

    fetchAllRatings().then((data) => {
      if (!data || !onServerData) return;
      const serverEntry = data[raterId];
      if (serverEntry?.ratings) {
        onServerData({ [raterId]: serverEntry.ratings });
      }
    });
  }, [enabled, raterId, onServerData]);

  const sync = useCallback(async () => {
    if (!raterId || !raterName || !enabled) return;
    const raterRatings = ratings[raterId];
    if (!raterRatings) return;

    const payload = JSON.stringify({ raterId, name: raterName, ratings: raterRatings });
    // Skip if nothing changed since last sync
    if (payload === lastSyncedRef.current) return;

    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (res.ok) {
        lastSyncedRef.current = payload;
      }
    } catch {
      // Server unavailable, will retry on next change
    }
  }, [raterId, raterName, ratings, enabled]);

  // Debounced sync on rating changes
  useEffect(() => {
    if (!enabled || !raterId) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(sync, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ratings, sync, enabled, raterId]);

  // Immediate sync on page hide / beforeunload
  useEffect(() => {
    if (!enabled || !raterId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") sync();
    };
    const handleBeforeUnload = () => sync();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sync, enabled, raterId]);
}

/**
 * Fetch all raters' ratings from the server.
 * Returns null if server is unavailable.
 */
export async function fetchAllRatings(): Promise<ServerRatingsResponse | null> {
  try {
    const res = await fetch("/api/ratings");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
