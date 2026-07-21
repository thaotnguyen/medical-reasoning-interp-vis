"use client";

import { LabelingSentenceList } from "./LabelingSentenceList";
import { KeyboardHints } from "./KeyboardHints";
import type { Sentence, TaxonomyItem } from "@/lib/types";
import type { RatingsStore } from "@/lib/labeling-types";
import { getProgress } from "@/hooks/useLabelingState";

interface LabelingPanelProps {
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

export function LabelingPanel({
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
}: LabelingPanelProps) {
  const { labeled, total } = getProgress(
    ratings,
    rater,
    model,
    dataset,
    caseId,
    sentences.length
  );
  const pct = total > 0 ? (labeled / total) * 100 : 0;
  const isComplete = labeled === total && total > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Progress bar */}
      <div className="px-4 py-2 border-b shrink-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">
            {labeled} / {total} sentences labeled
          </span>
          {isComplete && (
            <span className="text-green-600 font-medium">Complete</span>
          )}
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor: isComplete ? "#16a34a" : "#3b82f6",
            }}
          />
        </div>
      </div>

      {/* Sentence list */}
      <LabelingSentenceList
        sentences={sentences}
        taxonomy={taxonomy}
        ratings={ratings}
        rater={rater}
        model={model}
        dataset={dataset}
        caseId={caseId}
        focusedIndex={focusedIndex}
        onFocus={onFocus}
        onLabel={onLabel}
        onClear={onClear}
      />

      {/* Keyboard hints */}
      <KeyboardHints />
    </div>
  );
}
