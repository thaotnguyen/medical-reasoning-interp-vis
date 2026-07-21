"use client";

import { schemeTableau10 } from "d3-scale-chromatic";
import type { TaxonomyItem, ClusterInfo } from "@/lib/types";

interface TSNELegendProps {
  colorMode: "taxonomy" | "cluster";
  taxonomy: TaxonomyItem[];
  clusters: Record<string, ClusterInfo>;
  /**
   * "wrap"   – horizontal strip under the plot (desktop).
   * "column" – one entry per line, for the narrow column beside the plot on phones.
   */
  layout?: "wrap" | "column";
}

export function TSNELegend({
  colorMode,
  taxonomy,
  clusters,
  layout = "wrap",
}: TSNELegendProps) {
  const column = layout === "column";
  const wrapCls = column
    ? "flex flex-col gap-1.5 px-2 py-2 overflow-y-auto h-full"
    : "flex flex-wrap gap-x-3 gap-y-1 px-3 py-2";
  const labelCls = column
    ? "text-muted-foreground leading-tight break-words"
    : "text-muted-foreground";

  if (colorMode === "taxonomy") {
    return (
      <div className={wrapCls}>
        {taxonomy.map((t, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px]">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 mt-[3px]"
              style={{ backgroundColor: t.color }}
            />
            <span className={labelCls}>{t.short_name}</span>
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
    <div className={wrapCls}>
      {clusterIds.map((id, i) => (
        <div key={id} className="flex items-start gap-1.5 text-[10px]">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 mt-[3px]"
            style={{ backgroundColor: schemeTableau10[i % 10] }}
          />
          <span
            className={
              column ? labelCls : "text-muted-foreground truncate max-w-[120px]"
            }
          >
            {clusters[String(id)].title}
          </span>
        </div>
      ))}
    </div>
  );
}
