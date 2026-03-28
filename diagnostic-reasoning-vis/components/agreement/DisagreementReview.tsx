"use client";

import { useMemo, useState } from "react";
import type { RatingsStore } from "@/lib/labeling-types";
import type { Case, TaxonomyItem } from "@/lib/types";
import type { ComparisonSource } from "./AgreementScopeSelector";
import {
  collectCaseComparisons,
  type CaseComparison,
} from "@/lib/agreement-stats";
import { CaseComparisonList } from "./CaseComparisonList";
import { SentenceComparisonView } from "./SentenceComparisonView";

type SentenceFilter = "all" | "disagreements" | "agreements";

interface DisagreementReviewProps {
  ratings: RatingsStore;
  casesMap: Record<string, Case[]>;
  sourceA: ComparisonSource;
  sourceB: ComparisonSource;
  sourceALabel: string;
  sourceBLabel: string;
  taxonomy: TaxonomyItem[];
}

const FILTER_OPTIONS: { value: SentenceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "disagreements", label: "Disagreements" },
  { value: "agreements", label: "Agreements" },
];

export function DisagreementReview({
  ratings,
  casesMap,
  sourceA,
  sourceB,
  sourceALabel,
  sourceBLabel,
  taxonomy,
}: DisagreementReviewProps) {
  const [filter, setFilter] = useState<SentenceFilter>("all");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const allCases = useMemo(() => {
    if (Object.keys(casesMap).length === 0) return [];

    // Handle whitebox-as-sourceA swap (same logic as AgreementDashboard)
    if (sourceA === "whitebox") {
      if (sourceB === "whitebox") return [];
      return collectCaseComparisons(ratings, casesMap, sourceB, "whitebox").map(
        (c) => ({
          ...c,
          sentences: c.sentences.map((s) => ({
            ...s,
            labelA: s.labelB,
            labelB: s.labelA,
          })),
        })
      );
    }

    return collectCaseComparisons(ratings, casesMap, sourceA, sourceB);
  }, [ratings, casesMap, sourceA, sourceB]);

  // Filter cases at the list level
  const filteredCases = useMemo(() => {
    if (filter === "all") return allCases;
    if (filter === "disagreements") return allCases.filter((c) => c.disagreements > 0);
    return allCases.filter((c) => c.disagreements === 0);
  }, [allCases, filter]);

  const totalCases = allCases.length;
  const casesWithDisagreements = allCases.filter((c) => c.disagreements > 0).length;

  const selectedCase: CaseComparison | null =
    selectedIdx !== null && selectedIdx < filteredCases.length
      ? filteredCases[selectedIdx]
      : null;

  if (totalCases === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No cases with co-labeled sentences for this comparison pair.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar + summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setSelectedIdx(null); }}
              className={`
                px-2.5 py-1 text-xs rounded-md border transition-colors
                ${filter === opt.value
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-accent border-border"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          {totalCases} cases reviewed
          {casesWithDisagreements > 0 && (
            <span>
              {" · "}
              <span className="text-red-500">{casesWithDisagreements} with disagreements</span>
            </span>
          )}
        </div>
      </div>

      {/* List + Detail */}
      <div className="flex border rounded-lg overflow-hidden" style={{ height: 480 }}>
        {/* Case list */}
        <div className="w-[38%] border-r shrink-0 overflow-hidden">
          <CaseComparisonList
            cases={filteredCases}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
          />
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-hidden">
          {selectedCase ? (
            <SentenceComparisonView
              caseData={selectedCase}
              sourceALabel={sourceALabel}
              sourceBLabel={sourceBLabel}
              taxonomy={taxonomy}
              filter={filter}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Select a case to review sentences
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
