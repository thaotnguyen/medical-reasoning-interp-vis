"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RatingsStore, SentenceRating } from "@/lib/labeling-types";
import { importRatings as mergeRatings } from "@/lib/labeling-storage";

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
        if (ratings[rater]?.[model]?.[dataset]?.[caseId]) {
          delete ratings[rater][model][dataset][caseId][sentIdx];
          set({ ratings });
        }
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
  return ratings[rater]?.[model]?.[dataset]?.[caseId]?.[sentIdx];
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
  const labeled = caseRatings ? Object.keys(caseRatings).length : 0;
  return { labeled, total: totalSentences };
}
