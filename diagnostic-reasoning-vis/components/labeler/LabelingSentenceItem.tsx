"use client";

import type { TaxonomyItem } from "@/lib/types";
import { Circle, CheckCircle2 } from "lucide-react";
import { TaxonomyPicker } from "./TaxonomyPicker";

interface LabelingSentenceItemProps {
  text: string;
  sentenceIndex: number;
  taxonomy: TaxonomyItem[];
  humanLabel: number | undefined; // taxonomy index assigned by human, or undefined
  isFocused: boolean;
  onFocus: (index: number) => void;
  onLabel: (taxonomyIndex: number) => void;
  onClear: () => void;
}

export function LabelingSentenceItem({
  text,
  sentenceIndex,
  taxonomy,
  humanLabel,
  isFocused,
  onFocus,
  onLabel,
  onClear,
}: LabelingSentenceItemProps) {
  const isLabeled = humanLabel !== undefined;
  const labelColor = isLabeled ? taxonomy[humanLabel]?.color : undefined;
  const labelName = isLabeled ? taxonomy[humanLabel]?.short_name : undefined;

  return (
    <div
      className={`group transition-colors ${
        isFocused
          ? "bg-accent ring-2 ring-primary/40 ring-inset"
          : "hover:bg-accent/40"
      }`}
      data-sentence-index={sentenceIndex}
      onClick={() => onFocus(sentenceIndex)}
    >
      <div className="flex gap-2 px-3 py-1.5 text-xs leading-relaxed cursor-pointer">
        {/* Status indicator */}
        <div className="shrink-0 mt-0.5">
          {isLabeled ? (
            <CheckCircle2
              className="w-3.5 h-3.5"
              style={{ color: labelColor }}
            />
          ) : (
            <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
          )}
        </div>

        {/* Sentence content */}
        <div className="flex-1 min-w-0">
          <span className="text-muted-foreground text-[10px] font-mono mr-1.5">
            {sentenceIndex + 1}.
          </span>
          {isLabeled && (
            <span
              className="inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium mr-1.5"
              style={{
                backgroundColor: `${labelColor}20`,
                color: labelColor,
              }}
            >
              {labelName}
            </span>
          )}
          {text}
        </div>
      </div>

      {/* Inline taxonomy picker when focused */}
      {isFocused && (
        <div className="px-3 pb-2">
          <TaxonomyPicker
            taxonomy={taxonomy}
            currentSelection={humanLabel}
            onSelect={onLabel}
            onClear={onClear}
          />
        </div>
      )}
    </div>
  );
}
