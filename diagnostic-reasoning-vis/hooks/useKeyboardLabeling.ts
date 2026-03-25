"use client";

import { useEffect, useCallback } from "react";
import { TAXONOMY_KEYBOARD_MAP } from "@/lib/labeling-types";
import type { RatingsStore } from "@/lib/labeling-types";
import { getRating } from "./useLabelingState";

interface UseKeyboardLabelingOptions {
  enabled: boolean;
  rater: string | null;
  model: string;
  dataset: string;
  caseId: string;
  ratings: RatingsStore;
  totalSentences: number;
  focusedIndex: number;
  onFocus: (index: number) => void;
  onLabel: (sentIdx: number, taxonomy: number) => void;
  onClear: (sentIdx: number) => void;
  onToggleHelp?: () => void;
}

export function useKeyboardLabeling({
  enabled,
  rater,
  model,
  dataset,
  caseId,
  ratings,
  totalSentences,
  focusedIndex,
  onFocus,
  onLabel,
  onClear,
  onToggleHelp,
}: UseKeyboardLabelingOptions) {
  const findNextUnlabeled = useCallback(
    (from: number, direction: 1 | -1): number => {
      if (!rater) return from;
      for (let i = 1; i <= totalSentences; i++) {
        const idx = (from + i * direction + totalSentences) % totalSentences;
        if (!getRating(ratings, rater, model, dataset, caseId, idx)) {
          return idx;
        }
      }
      return from; // All labeled
    },
    [rater, model, dataset, caseId, ratings, totalSentences]
  );

  useEffect(() => {
    if (!enabled || !rater || totalSentences === 0) return;

    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Help toggle
      if (e.key === "?") {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }

      // Number keys: assign taxonomy
      if (TAXONOMY_KEYBOARD_MAP[e.key] !== undefined) {
        e.preventDefault();
        const taxonomy = TAXONOMY_KEYBOARD_MAP[e.key];
        onLabel(focusedIndex, taxonomy);
        // Auto-advance to next unlabeled
        const next = findNextUnlabeled(focusedIndex, 1);
        onFocus(next);
        return;
      }

      // Clear
      if (e.key === "0" || e.key === "Backspace") {
        e.preventDefault();
        onClear(focusedIndex);
        return;
      }

      // Navigate
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        onFocus(Math.min(focusedIndex + 1, totalSentences - 1));
        return;
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        onFocus(Math.max(focusedIndex - 1, 0));
        return;
      }

      // Tab: jump to next/prev unlabeled
      if (e.key === "Tab") {
        e.preventDefault();
        const next = findNextUnlabeled(focusedIndex, e.shiftKey ? -1 : 1);
        onFocus(next);
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled, rater, totalSentences, focusedIndex, onLabel, onClear, onFocus, onToggleHelp, findNextUnlabeled]);
}
