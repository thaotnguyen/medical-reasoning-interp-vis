"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CaseComparison, SentenceComparison } from "@/lib/agreement-stats";
import type { TaxonomyItem } from "@/lib/types";

type SentenceFilter = "all" | "disagreements" | "agreements";

interface SentenceComparisonViewProps {
  caseData: CaseComparison;
  sourceALabel: string;
  sourceBLabel: string;
  taxonomy: TaxonomyItem[];
  filter: SentenceFilter;
}

function LabelBadge({
  label,
  taxonomy,
}: {
  label: number;
  taxonomy: TaxonomyItem[];
}) {
  if (label < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
        —
      </span>
    );
  }

  const tax = taxonomy[label];
  if (!tax) return null;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold text-white"
      style={{ backgroundColor: tax.color }}
    >
      {tax.short_name}
    </span>
  );
}

function filterSentence(s: SentenceComparison, filter: SentenceFilter): boolean {
  const bothLabeled = s.labelA >= 0 && s.labelB >= 0;
  if (!bothLabeled) return filter === "all";
  if (filter === "disagreements") return !s.agrees;
  if (filter === "agreements") return s.agrees;
  return true;
}

export function SentenceComparisonView({
  caseData,
  sourceALabel,
  sourceBLabel,
  taxonomy,
  filter,
}: SentenceComparisonViewProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);

  const filtered = caseData.sentences.filter((s) => filterSentence(s, filter));
  const shownCount = filtered.length;
  const totalCount = caseData.sentences.length;

  return (
    <div className="flex flex-col h-full">
      {/* Case header */}
      <div className="px-4 py-3 border-b shrink-0 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{caseData.model}</span>
          <span>·</span>
          <span>{caseData.dataset}</span>
        </div>
        <div className="text-sm font-medium truncate">
          Dx: {caseData.trueDx}
        </div>
        <div className="text-xs text-muted-foreground">
          {shownCount === totalCount
            ? `${totalCount} sentences`
            : `Showing ${shownCount} of ${totalCount} sentences`}
          {" · "}
          <span className="text-emerald-600">{caseData.agreements} agree</span>
          {" · "}
          <span className="text-red-500">{caseData.disagreements} disagree</span>
        </div>

        {/* Expandable prompt */}
        <button
          onClick={() => setPromptExpanded((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        >
          {promptExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          Case prompt
        </button>
        {promptExpanded && (
          <p className="text-xs text-muted-foreground leading-relaxed max-h-32 overflow-auto whitespace-pre-wrap border rounded p-2 bg-muted/30">
            {caseData.prompt}
          </p>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-muted/30 shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Sentence</span>
        <span className="w-16 text-center">{sourceALabel}</span>
        <span className="w-16 text-center">{sourceBLabel}</span>
      </div>

      {/* Sentence rows */}
      <ScrollArea className="flex-1 min-h-0">
        <div>
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No sentences match the current filter.
            </div>
          ) : (
            filtered.map((s) => {
              const bothLabeled = s.labelA >= 0 && s.labelB >= 0;
              const isDisagreement = bothLabeled && !s.agrees;

              return (
                <div
                  key={s.sentIdx}
                  className={`
                    flex items-start gap-3 px-4 py-2 border-b border-l-2 text-xs
                    ${isDisagreement
                      ? "border-l-red-400 bg-red-50 dark:bg-red-950/20"
                      : "border-l-transparent"
                    }
                  `}
                >
                  <span className="w-6 text-center text-muted-foreground/50 font-mono tabular-nums shrink-0 pt-0.5">
                    {s.sentIdx}
                  </span>
                  <span className="flex-1 leading-relaxed">{s.text}</span>
                  <span className="w-16 text-center shrink-0 pt-0.5">
                    <LabelBadge label={s.labelA} taxonomy={taxonomy} />
                  </span>
                  <span className="w-16 text-center shrink-0 pt-0.5">
                    <LabelBadge label={s.labelB} taxonomy={taxonomy} />
                  </span>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
