"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SentenceItem } from "./SentenceItem";
import type { Sentence, TaxonomyItem } from "@/lib/types";

interface SentenceListProps {
  sentences: Sentence[];
  taxonomy: TaxonomyItem[];
  hoveredSentenceIndex: number | null;
  onHoverSentence: (index: number | null) => void;
}

export function SentenceList({
  sentences,
  taxonomy,
  hoveredSentenceIndex,
  onHoverSentence,
}: SentenceListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll hovered sentence into view (when triggered externally, e.g. from t-SNE)
  useEffect(() => {
    if (hoveredSentenceIndex === null || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-sentence-index="${hoveredSentenceIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [hoveredSentenceIndex]);

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div ref={containerRef} className="py-1">
        {sentences.map((sent, idx) => (
          <SentenceItem
            key={idx}
            text={sent.s}
            taxonomyIndex={sent.t}
            taxonomy={taxonomy}
            sentenceIndex={idx}
            isHovered={hoveredSentenceIndex === idx}
            onHover={onHoverSentence}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
