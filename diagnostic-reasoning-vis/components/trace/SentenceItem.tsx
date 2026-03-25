"use client";

import type { TaxonomyItem } from "@/lib/types";
import { NO_DATA_COLOR } from "@/lib/constants";

interface SentenceItemProps {
  text: string;
  taxonomyIndex: number;
  taxonomy: TaxonomyItem[];
  sentenceIndex: number;
  isHovered: boolean;
  onHover: (index: number | null) => void;
}

export function SentenceItem({
  text,
  taxonomyIndex,
  taxonomy,
  sentenceIndex,
  isHovered,
  onHover,
}: SentenceItemProps) {
  const color =
    taxonomyIndex >= 0 && taxonomyIndex < taxonomy.length
      ? taxonomy[taxonomyIndex].color
      : NO_DATA_COLOR;

  const label =
    taxonomyIndex >= 0 && taxonomyIndex < taxonomy.length
      ? taxonomy[taxonomyIndex].short_name
      : "Unknown";

  return (
    <div
      className={`flex gap-2 px-3 py-1.5 text-xs leading-relaxed cursor-pointer transition-colors ${
        isHovered ? "bg-accent" : "hover:bg-accent/50"
      }`}
      onMouseEnter={() => onHover(sentenceIndex)}
      onMouseLeave={() => onHover(null)}
      data-sentence-index={sentenceIndex}
    >
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground text-[10px] mr-1">[{label}]</span>
        {text}
      </div>
    </div>
  );
}
