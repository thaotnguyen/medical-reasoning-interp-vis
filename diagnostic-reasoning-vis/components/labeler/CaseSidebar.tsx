"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Circle, Minus } from "lucide-react";
import type { SampleItem } from "@/lib/sample-pool";
import type { Metadata } from "@/lib/types";
import type { RatingsStore, CasePoolInfo } from "@/lib/labeling-types";
import { getPoolPhase } from "@/lib/labeler-ui";

interface CaseSidebarProps {
  pool: SampleItem[];
  metadata: Metadata;
  selectedIndex: number;
  onSelect: (index: number) => void;
  ratings: RatingsStore;
  raterId: string;
  caseInfo: Map<string, CasePoolInfo>;
}

type CaseStatus = "complete" | "partial" | "empty";

function getCaseStatus(
  ratings: RatingsStore,
  raterId: string,
  model: string,
  dataset: string,
  caseId: string,
  totalSentences: number
): CaseStatus {
  const caseRatings = ratings[raterId]?.[model]?.[dataset]?.[caseId];
  if (!caseRatings) return "empty";
  // Tombstones (taxonomy < 0) are cleared labels; don't count them.
  const labeled = Object.values(caseRatings).filter((r) => r.taxonomy >= 0).length;
  if (labeled >= totalSentences) return "complete";
  if (labeled > 0) return "partial";
  return "empty";
}

const STATUS_CONFIG = {
  complete: { icon: Check, bg: "bg-emerald-500/15", border: "border-emerald-500/30", dot: "text-emerald-500" },
  partial: { icon: Minus, bg: "bg-amber-500/10", border: "border-amber-500/25", dot: "text-amber-500" },
  empty: { icon: Circle, bg: "", border: "border-transparent", dot: "text-muted-foreground/40" },
} as const;

function shortModelName(model: string, metadata: Metadata): string {
  const info = metadata.models[model];
  if (!info) return model;
  const name = info.display_name;
  if (name.length > 14) {
    return name.replace(" (DSR1)", "").replace("GPT OSS ", "GPT-");
  }
  return name;
}

function CaseRow({
  item,
  poolIndex,
  isSelected,
  status,
  metadata,
  dxLabel,
  onSelect,
}: {
  item: SampleItem;
  poolIndex: number;
  isSelected: boolean;
  status: CaseStatus;
  metadata: Metadata;
  dxLabel: string;
  onSelect: (index: number) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <button
      data-case-index={poolIndex}
      onClick={() => onSelect(poolIndex)}
      className={`
        w-full text-left px-2.5 py-1.5 flex items-center gap-2
        transition-colors duration-100 border-l-2 group
        ${isSelected
          ? status === "complete"
            ? "bg-emerald-500/15 border-l-emerald-500"
            : "bg-accent border-l-primary"
          : `hover:bg-accent/50 ${cfg.bg} ${cfg.border}`
        }
      `}
    >
      <Icon className={`w-3 h-3 shrink-0 ${isSelected ? "text-primary" : cfg.dot}`} />
      <span
        className={`text-[11px] font-mono tabular-nums w-5 shrink-0 ${
          isSelected ? "font-bold text-foreground" : "text-muted-foreground"
        }`}
      >
        {poolIndex}
      </span>
      <span
        className={`text-[9px] truncate leading-tight ${
          isSelected ? "text-foreground/70" : "text-muted-foreground/60"
        }`}
        title={dxLabel}
      >
        {shortModelName(item.model, metadata)}
        {dxLabel ? ` · ${dxLabel}` : ""}
      </span>
    </button>
  );
}

export function CaseSidebar({
  pool,
  metadata,
  selectedIndex,
  onSelect,
  ratings,
  raterId,
  caseInfo,
}: CaseSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const viewport = container.closest("[data-slot='scroll-area']")
      ?.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement | null;
    const el = container.querySelector(`[data-case-index="${selectedIndex}"]`) as HTMLElement | null;
    if (!viewport || !el) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    if (elTop < viewport.scrollTop) viewport.scrollTop = elTop;
    else if (elBottom > viewport.scrollTop + viewport.clientHeight)
      viewport.scrollTop = elBottom - viewport.clientHeight;
  }, [selectedIndex]);

  const practicePool = pool.filter(
    (item) => getPoolPhase(item.index, item.isTraining) === "training"
  );
  const casesPool = pool.filter(
    (item) => getPoolPhase(item.index, item.isTraining) === "test"
  );

  function infoFor(item: SampleItem): CasePoolInfo | undefined {
    return caseInfo.get(`${item.model}_${item.dataset}_${item.caseIndex}`);
  }

  function getStatus(item: SampleItem): CaseStatus {
    const info = infoFor(item);
    if (!info) return "empty";
    return getCaseStatus(ratings, raterId, item.model, item.dataset, info.caseId, info.sentenceCount);
  }

  const renderRow = (item: SampleItem) => (
    <CaseRow
      key={`${item.model}_${item.dataset}_${item.caseIndex}`}
      item={item}
      poolIndex={item.index}
      isSelected={item.index === selectedIndex}
      status={getStatus(item)}
      metadata={metadata}
      dxLabel={infoFor(item)?.trueDx ?? ""}
      onSelect={onSelect}
    />
  );

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="py-1">
          {/* Practice examples */}
          <div className="px-2.5 pt-2 pb-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-500/70">
              Practice examples
            </span>
          </div>
          {practicePool.map(renderRow)}

          {/* Cases */}
          <div className="px-2.5 pt-3 pb-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Cases
            </span>
          </div>
          {casesPool.map(renderRow)}
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t text-[9px] text-muted-foreground/50 shrink-0">
        <span className="font-mono">[</span>/<span className="font-mono">]</span> prev/next case
      </div>
    </div>
  );
}
