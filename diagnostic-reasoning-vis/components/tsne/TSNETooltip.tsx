"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { TSNEPoint, TaxonomyItem, ClusterInfo, Case } from "@/lib/types";

const CURSOR_GAP = 12;
const EDGE_PAD = 8;

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

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Keep the tooltip inside the plot: flip it to the left of the cursor when it would run off
  // the right edge, and clamp vertically. Measured after render (useLayoutEffect, so it is
  // corrected before paint) because the width depends on the sentence length.
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const maxX = parent.clientWidth;
    const maxY = parent.clientHeight;

    let left = mouseX + CURSOR_GAP;
    if (left + w > maxX - EDGE_PAD) left = mouseX - CURSOR_GAP - w;
    left = Math.max(EDGE_PAD, Math.min(left, maxX - w - EDGE_PAD));

    let top = mouseY - EDGE_PAD;
    top = Math.max(EDGE_PAD, Math.min(top, maxY - h - EDGE_PAD));

    setPos((prev) =>
      prev && prev.left === left && prev.top === top ? prev : { left, top }
    );
  }, [mouseX, mouseY, sentence, taxItem, clusterItem]);

  return (
    <div
      ref={ref}
      className="absolute z-50 pointer-events-none bg-popover border rounded-md shadow-lg px-3 py-2 max-w-xs text-xs"
      style={{
        left: pos ? pos.left : mouseX + CURSOR_GAP,
        top: pos ? pos.top : mouseY - EDGE_PAD,
        // Hidden for the single frame before the first measurement lands.
        visibility: pos ? "visible" : "hidden",
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
