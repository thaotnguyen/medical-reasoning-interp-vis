"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { CaseComparison } from "@/lib/agreement-stats";

interface CaseComparisonListProps {
  cases: CaseComparison[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}

export function CaseComparisonList({
  cases,
  selectedIdx,
  onSelect,
}: CaseComparisonListProps) {
  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
        No cases match the filter.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-1">
        {cases.map((c, idx) => {
          const isSelected = idx === selectedIdx;
          const pctAgree =
            c.totalCompared > 0
              ? Math.round((c.agreements / c.totalCompared) * 100)
              : 0;
          const pctDisagree = 100 - pctAgree;

          return (
            <button
              key={`${c.model}_${c.dataset}_${c.caseId}`}
              onClick={() => onSelect(idx)}
              className={`
                w-full text-left px-3 py-2.5 border-b transition-colors
                ${isSelected ? "bg-accent" : "hover:bg-accent/50"}
              `}
            >
              {/* Model */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 mb-0.5">
                <span className="font-mono truncate">{c.model}</span>
              </div>

              {/* Diagnosis */}
              <div className="text-xs font-medium truncate mb-1.5">
                {c.trueDx}
              </div>

              {/* Agreement bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex">
                  {pctAgree > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${pctAgree}%` }}
                    />
                  )}
                  {pctDisagree > 0 && (
                    <div
                      className="h-full bg-red-400"
                      style={{ width: `${pctDisagree}%` }}
                    />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {c.agreements}/{c.totalCompared}
                  {c.disagreements > 0 && (
                    <span className="text-red-500 ml-1">
                      ({c.disagreements})
                    </span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
