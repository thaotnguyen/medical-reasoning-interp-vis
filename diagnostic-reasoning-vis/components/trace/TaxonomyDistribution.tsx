"use client";

import { useMemo } from "react";
import type { Sentence, TaxonomyItem } from "@/lib/types";

interface TaxonomyDistributionProps {
  sentences: Sentence[];
  taxonomy: TaxonomyItem[];
}

export function TaxonomyDistribution({ sentences, taxonomy }: TaxonomyDistributionProps) {
  const distribution = useMemo(() => {
    const counts = new Array(taxonomy.length).fill(0);
    for (const s of sentences) {
      if (s.t >= 0 && s.t < taxonomy.length) {
        counts[s.t]++;
      }
    }
    return counts;
  }, [sentences, taxonomy]);

  const total = sentences.length || 1;

  return (
    <div className="px-4 py-2 border-b">
      {/* Stacked bar */}
      <div className="flex h-4 rounded-sm overflow-hidden">
        {distribution.map((count, i) => {
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={i}
              className="h-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: taxonomy[i].color,
              }}
              title={`${taxonomy[i].short_name}: ${count} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {distribution.map((count, i) => {
          if (count === 0) return null;
          return (
            <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: taxonomy[i].color }}
              />
              <span>{taxonomy[i].short_name} ({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
