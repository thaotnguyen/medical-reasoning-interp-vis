"use client";

import type { TSNEPoint, TaxonomyItem, ClusterInfo, Case } from "@/lib/types";

interface TSNETooltipProps {
  point: TSNEPoint;
  colorMode: "taxonomy" | "cluster";
  taxonomy: TaxonomyItem[];
  clusters: Record<string, ClusterInfo>;
  cases: Case[] | undefined;
  mouseX: number;
  mouseY: number;
}

export function TSNETooltip({
  point,
  colorMode,
  taxonomy,
  clusters,
  cases,
  mouseX,
  mouseY,
}: TSNETooltipProps) {
  const [, , taxIdx, clusterId, caseIdx, sentIdx] = point;

  const sentence = cases?.[caseIdx]?.sentences?.[sentIdx]?.s;
  const taxItem = taxIdx >= 0 && taxIdx < taxonomy.length ? taxonomy[taxIdx] : null;
  const clusterItem = clusters[String(clusterId)];

  return (
    <div
      className="absolute z-50 pointer-events-none bg-popover border rounded-md shadow-lg px-3 py-2 max-w-xs text-xs"
      style={{
        left: mouseX + 12,
        top: mouseY - 8,
      }}
    >
      {colorMode === "taxonomy" && taxItem && (
        <div className="flex items-center gap-1.5 mb-1">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: taxItem.color }}
          />
          <span className="font-medium">{taxItem.short_name}</span>
        </div>
      )}
      {colorMode === "cluster" && clusterItem && (
        <div className="mb-1">
          <span className="font-medium">
            Cluster {clusterId}: {clusterItem.title}
          </span>
        </div>
      )}
      {sentence && (
        <p className="text-muted-foreground leading-relaxed mt-1">
          {sentence.length > 200 ? sentence.slice(0, 200) + "..." : sentence}
        </p>
      )}
    </div>
  );
}
