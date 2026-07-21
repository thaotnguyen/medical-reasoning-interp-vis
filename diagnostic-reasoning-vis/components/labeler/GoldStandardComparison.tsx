"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { Sentence, TaxonomyItem } from "@/lib/types";
import type { RatingsStore } from "@/lib/labeling-types";
import { getRating } from "@/hooks/useLabelingState";

/** Gold standard labels: sentenceIndex (string) -> taxonomy (number) */
export type GoldLabels = Record<string, number>;

interface GoldStandardComparisonProps {
  sentences: Sentence[];
  taxonomy: TaxonomyItem[];
  ratings: RatingsStore;
  raterId: string;
  model: string;
  dataset: string;
  caseId: string;
  goldLabels: GoldLabels;
}

function TaxLabel({
  index,
  taxonomy,
  placeholder,
}: {
  index: number | undefined;
  taxonomy: TaxonomyItem[];
  placeholder?: string;
}) {
  if (index === undefined || index < 0 || index >= taxonomy.length) {
    return (
      <span className="text-[10px] text-muted-foreground/40 italic">
        {placeholder ?? "—"}
      </span>
    );
  }
  const item = taxonomy[index];
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm"
      style={{ backgroundColor: `${item.color}25`, color: item.color }}
    >
      {item.short_name}
    </span>
  );
}

export function GoldStandardComparison({
  sentences,
  taxonomy,
  ratings,
  raterId,
  model,
  dataset,
  caseId,
  goldLabels,
}: GoldStandardComparisonProps) {
  const hasGold = Object.keys(goldLabels).some((k) => k !== "_note");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column headers */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0 bg-muted/20">
        <span className="w-7 shrink-0" />
        <span className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Sentence
        </span>
        <span className="w-28 shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Your Label
        </span>
        <span className="w-28 shrink-0 text-[10px] font-semibold text-blue-500/70 uppercase tracking-wider">
          Gold Standard
        </span>
      </div>

      {!hasGold && (
        <div className="px-4 py-2 shrink-0 bg-blue-500/5 border-b">
          <p className="text-[10px] text-blue-500/70 italic">
            Gold standard not yet uploaded. Labels will appear here once{" "}
            <code className="font-mono">training_gold.json</code> is populated.
          </p>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {sentences.map((sent, idx) => {
            const myRating = getRating(ratings, raterId, model, dataset, caseId, idx);
            const myLabel = myRating?.taxonomy;
            const goldLabel = goldLabels[String(idx)] !== undefined
              ? Number(goldLabels[String(idx)])
              : undefined;

            const match =
              myLabel !== undefined && goldLabel !== undefined
                ? myLabel === goldLabel
                : null;

            const rowBg =
              match === true
                ? "bg-emerald-500/8"
                : match === false
                ? "bg-red-500/8"
                : "";

            return (
              <div
                key={idx}
                className={`flex items-start gap-2 px-4 py-2 border-b border-border/30 ${rowBg}`}
              >
                {/* Sentence number */}
                <span className="w-7 shrink-0 text-[10px] font-mono text-muted-foreground/40 pt-0.5">
                  {idx + 1}
                </span>

                {/* Sentence text */}
                <p className="flex-1 text-sm leading-snug text-foreground/80 min-w-0">
                  {sent.s}
                </p>

                {/* Your label */}
                <div className="w-28 shrink-0 pt-0.5">
                  <TaxLabel index={myLabel} taxonomy={taxonomy} placeholder="not labeled" />
                </div>

                {/* Gold label */}
                <div className="w-28 shrink-0 pt-0.5">
                  {hasGold ? (
                    <TaxLabel index={goldLabel} taxonomy={taxonomy} />
                  ) : (
                    <span className="text-[10px] text-muted-foreground/25 italic">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
