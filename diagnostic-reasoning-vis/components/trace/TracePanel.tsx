"use client";

import { DiagnosisBar } from "./DiagnosisBar";
import { TraceStats } from "./TraceStats";
import { TaxonomyDistribution } from "./TaxonomyDistribution";
import { SentenceList } from "./SentenceList";
import type { Case, TaxonomyItem } from "@/lib/types";

interface TracePanelProps {
  currentCase: Case;
  taxonomy: TaxonomyItem[];
  hoveredSentenceIndex: number | null;
  onHoverSentence: (index: number | null) => void;
}

export function TracePanel({
  currentCase,
  taxonomy,
  hoveredSentenceIndex,
  onHoverSentence,
}: TracePanelProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <DiagnosisBar
        predictedDx={currentCase.pred_dx}
        trueDx={currentCase.true_dx}
        isCorrect={currentCase.correct}
      />
      <TraceStats sentenceCount={currentCase.sentences.length} />
      <TaxonomyDistribution
        sentences={currentCase.sentences}
        taxonomy={taxonomy}
      />
      <SentenceList
        sentences={currentCase.sentences}
        taxonomy={taxonomy}
        hoveredSentenceIndex={hoveredSentenceIndex}
        onHoverSentence={onHoverSentence}
      />
    </div>
  );
}
