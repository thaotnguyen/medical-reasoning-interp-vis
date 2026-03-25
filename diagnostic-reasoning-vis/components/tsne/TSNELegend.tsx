"use client";

import { schemeTableau10 } from "d3-scale-chromatic";
import type { TaxonomyItem, ClusterInfo } from "@/lib/types";

interface TSNELegendProps {
  colorMode: "taxonomy" | "cluster";
  taxonomy: TaxonomyItem[];
  clusters: Record<string, ClusterInfo>;
}

export function TSNELegend({ colorMode, taxonomy, clusters }: TSNELegendProps) {
  if (colorMode === "taxonomy") {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2">
        {taxonomy.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: t.color }}
            />
            <span className="text-muted-foreground">{t.short_name}</span>
          </div>
        ))}
      </div>
    );
  }

  // Cluster mode
  const clusterIds = Object.keys(clusters)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2">
      {clusterIds.map((id, i) => (
        <div key={id} className="flex items-center gap-1.5 text-[10px]">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: schemeTableau10[i % 10] }}
          />
          <span className="text-muted-foreground truncate max-w-[120px]">
            {clusters[String(id)].title}
          </span>
        </div>
      ))}
    </div>
  );
}
