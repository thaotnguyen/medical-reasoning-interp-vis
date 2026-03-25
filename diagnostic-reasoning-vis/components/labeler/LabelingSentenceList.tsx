"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LabelingSentenceItem } from "./LabelingSentenceItem";
import type { Sentence, TaxonomyItem } from "@/lib/types";
import type { RatingsStore } from "@/lib/labeling-types";
import { getRating } from "@/hooks/useLabelingState";

interface LabelingSentenceListProps {
  sentences: Sentence[];
  taxonomy: TaxonomyItem[];
  ratings: RatingsStore;
  rater: string;
  model: string;
  dataset: string;
  caseId: string;
  focusedIndex: number;
  onFocus: (index: number) => void;
  onLabel: (sentIdx: number, taxonomy: number) => void;
  onClear: (sentIdx: number) => void;
}

export function LabelingSentenceList({
  sentences,
  taxonomy,
  ratings,
  rater,
  model,
  dataset,
  caseId,
  focusedIndex,
  onFocus,
  onLabel,
  onClear,
}: LabelingSentenceListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll focused sentence into view
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-sentence-index="${focusedIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex]);

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div ref={containerRef} className="py-1">
        {sentences.map((sent, idx) => {
          const rating = getRating(ratings, rater, model, dataset, caseId, idx);
          return (
            <LabelingSentenceItem
              key={idx}
              text={sent.s}
              sentenceIndex={idx}
              taxonomy={taxonomy}
              humanLabel={rating?.taxonomy}
              isFocused={focusedIndex === idx}
              onFocus={onFocus}
              onLabel={(t) => onLabel(idx, t)}
              onClear={() => onClear(idx)}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}
