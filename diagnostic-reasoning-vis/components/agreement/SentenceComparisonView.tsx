"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
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

/** Show only the clinical case: drop the leading instructions and the trailing OUTPUT TEMPLATE. */
function caseText(prompt: string): string {
  let s = prompt;
  const start = s.indexOf("CASE PRESENTATION");
  if (start !== -1) s = s.slice(start + "CASE PRESENTATION".length).replace(/^[-\s]+/, "");
  const end = s.indexOf("OUTPUT TEMPLATE");
  if (end !== -1) s = s.slice(0, end).replace(/[-\s]+$/, "");
  return s;
}

/** A category label styled like the labeler's choices: light tint + darker text. */
function LabelBadge({ label, taxonomy }: { label: number; taxonomy: TaxonomyItem[] }) {
  if (label < 0) {
    return <span className="text-[10px] text-muted-foreground/50">—</span>;
  }
  const tax = taxonomy[label];
  if (!tax) return null;
  return (
    <span
      className="inline-block max-w-full align-top px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-normal break-words leading-snug"
      style={{ backgroundColor: `${tax.color}20`, color: tax.color }}
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
  const filtered = caseData.sentences.filter((s) => filterSentence(s, filter));

  return (
    <div className="flex flex-col h-full">
      {/* Case prompt */}
      <div className="px-4 py-3 border-b shrink-0">
        <p className="text-xs text-muted-foreground leading-relaxed max-h-40 overflow-auto whitespace-pre-wrap">
          {caseText(caseData.prompt)}
        </p>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-muted/30 shrink-0 text-[10px] font-semibold text-muted-foreground">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Sentence</span>
        <span className="w-24 truncate">{sourceALabel}</span>
        <span className="w-24 truncate">{sourceBLabel}</span>
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
                  <span className="w-24 shrink-0 pt-0.5 min-w-0">
                    <LabelBadge label={s.labelA} taxonomy={taxonomy} />
                  </span>
                  <span className="w-24 shrink-0 pt-0.5 min-w-0">
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
