"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LabelingSentenceItem } from "./LabelingSentenceItem";
import type { Sentence, TaxonomyItem } from "@/lib/types";
import type { RatingsStore } from "@/lib/labeling-types";
import { getRating } from "@/hooks/useLabelingState";
import { mapTaxonomy } from "@/lib/taxonomy-map";

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

  // Scroll focused sentence into view within the Radix ScrollArea viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewport = container.closest("[data-slot='scroll-area']")
      ?.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement | null;
    const el = container.querySelector(
      `[data-sentence-index="${focusedIndex}"]`
    ) as HTMLElement | null;
    if (!viewport || !el) return;

    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const vpTop = viewport.scrollTop;
    const vpBottom = vpTop + viewport.clientHeight;

    if (elTop < vpTop) {
      viewport.scrollTop = elTop;
    } else if (elBottom > vpBottom) {
      viewport.scrollTop = elBottom - viewport.clientHeight;
    }
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
              humanLabel={rating ? mapTaxonomy(rating.taxonomy) : undefined}
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
