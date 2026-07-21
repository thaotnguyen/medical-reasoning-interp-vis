"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RatingsStore, SentenceRating } from "@/lib/labeling-types";
import { importRatings as mergeRatings } from "@/lib/labeling-storage";

// Sentinel taxonomy value marking a cleared rating (tombstone). Any taxonomy < 0
// means "not labeled"; readers must treat it as an absent rating.
export const CLEARED_TAXONOMY = -1;

interface LabelingState {
  ratings: RatingsStore;
  focusedSentenceIndex: number;

  setFocusedSentence: (index: number) => void;

  setRating: (
    rater: string,
    model: string,
    dataset: string,
    caseId: string,
    sentIdx: number,
    taxonomy: number
  ) => void;

  clearRating: (
    rater: string,
    model: string,
    dataset: string,
    caseId: string,
    sentIdx: number
  ) => void;

  importRatings: (imported: RatingsStore) => void;
}

export const useLabelingState = create<LabelingState>()(
  persist(
    (set, get) => ({
      ratings: {},
      focusedSentenceIndex: 0,

      setFocusedSentence: (index) => set({ focusedSentenceIndex: index }),

      setRating: (rater, model, dataset, caseId, sentIdx, taxonomy) => {
        const ratings = JSON.parse(JSON.stringify(get().ratings)) as RatingsStore;
        if (!ratings[rater]) ratings[rater] = {};
        if (!ratings[rater][model]) ratings[rater][model] = {};
        if (!ratings[rater][model][dataset]) ratings[rater][model][dataset] = {};
        if (!ratings[rater][model][dataset][caseId])
          ratings[rater][model][dataset][caseId] = {};

        const rating: SentenceRating = { taxonomy, timestamp: Date.now() };
        ratings[rater][model][dataset][caseId][sentIdx] = rating;
        set({ ratings });
      },

      clearRating: (rater, model, dataset, caseId, sentIdx) => {
        const ratings = JSON.parse(JSON.stringify(get().ratings)) as RatingsStore;
        if (!ratings[rater]) ratings[rater] = {};
        if (!ratings[rater][model]) ratings[rater][model] = {};
        if (!ratings[rater][model][dataset]) ratings[rater][model][dataset] = {};
        if (!ratings[rater][model][dataset][caseId])
          ratings[rater][model][dataset][caseId] = {};

        // Write a tombstone (taxonomy < 0) rather than deleting the key, so the
        // cleared state carries a timestamp and survives the timestamp-based
        // merge with server data (a hard delete would silently be resurrected
        // by a previously-synced rating in the Agreement view).
        ratings[rater][model][dataset][caseId][sentIdx] = {
          taxonomy: CLEARED_TAXONOMY,
          timestamp: Date.now(),
        };
        set({ ratings });
      },

      importRatings: (imported) => {
        const merged = mergeRatings(get().ratings, imported);
        set({ ratings: merged });
      },
    }),
    {
      name: "drv-ratings",
      partialize: (state) => ({
        ratings: state.ratings,
      }),
    }
  )
);

// Helper selectors
export function getRating(
  ratings: RatingsStore,
  rater: string,
  model: string,
  dataset: string,
  caseId: string,
  sentIdx: number
): SentenceRating | undefined {
  const r = ratings[rater]?.[model]?.[dataset]?.[caseId]?.[sentIdx];
  // Tombstones (taxonomy < 0) read as "no rating".
  if (!r || r.taxonomy < 0) return undefined;
  return r;
}

export function getProgress(
  ratings: RatingsStore,
  rater: string,
  model: string,
  dataset: string,
  caseId: string,
  totalSentences: number
): { labeled: number; total: number } {
  const caseRatings = ratings[rater]?.[model]?.[dataset]?.[caseId];
  const labeled = caseRatings
    ? Object.values(caseRatings).filter((r) => r.taxonomy >= 0).length
    : 0;
  return { labeled, total: totalSentences };
}
