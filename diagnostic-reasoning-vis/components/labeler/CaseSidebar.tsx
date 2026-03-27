"use client";

import { useRef, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Circle, Minus } from "lucide-react";
import type { SampleItem } from "@/lib/sample-pool";
import type { Metadata } from "@/lib/types";
import type { RatingsStore, CasePoolInfo } from "@/lib/labeling-types";

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
  const labeled = Object.keys(caseRatings).length;
  if (labeled >= totalSentences) return "complete";
  if (labeled > 0) return "partial";
  return "empty";
}

const STATUS_CONFIG = {
  complete: {
    icon: Check,
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    dot: "text-emerald-500",
  },
  partial: {
    icon: Minus,
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    dot: "text-amber-500",
  },
  empty: {
    icon: Circle,
    bg: "",
    border: "border-transparent",
    dot: "text-muted-foreground/40",
  },
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

function shortDatasetName(dataset: string): string {
  const map: Record<string, string> = {
    medqa: "MedQA",
    "medmcqa-filtered": "MCQ",
    "nejm-cpc": "NEJM",
  };
  return map[dataset] ?? dataset;
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

  // Scroll selected item into view within the ScrollArea viewport
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // Find the Radix ScrollArea viewport (the actual scrollable div)
    const viewport = container.closest("[data-slot='scroll-area']")
      ?.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement | null;
    const el = container.querySelector(`[data-case-index="${selectedIndex}"]`) as HTMLElement | null;
    if (!viewport || !el) return;

    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const vpTop = viewport.scrollTop;
    const vpBottom = vpTop + viewport.clientHeight;

    if (elTop < vpTop) {
      viewport.scrollTop = elTop;
    } else if (elBottom > vpBottom) {
      viewport.scrollTop = elBottom - viewport.clientHeight;
    }
  }, [selectedIndex]);

  // Compute overall progress
  const { completed, partial, total: totalCases } = useMemo(() => {
    let completed = 0;
    let partial = 0;
    for (const item of pool) {
      const key = `${item.model}_${item.dataset}_${item.caseIndex}`;
      const info = caseInfo.get(key);
      if (!info) continue;
      const status = getCaseStatus(ratings, raterId, item.model, item.dataset, info.caseId, info.sentenceCount);
      if (status === "complete") completed++;
      else if (status === "partial") partial++;
    }
    return { completed, partial, total: pool.length };
  }, [pool, ratings, raterId, caseInfo]);

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      {/* Header */}
      <div className="px-3 py-2.5 border-b shrink-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cases
        </div>
        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
          {completed > 0 || partial > 0
            ? `${completed} done · ${partial} in progress · ${totalCases - completed - partial} remaining`
            : `${pool.length} to label`}
        </div>
      </div>

      {/* Case list */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="py-1">
          {pool.map((item, i) => {
            const isSelected = i === selectedIndex;
            const key = `${item.model}_${item.dataset}_${item.caseIndex}`;
            const info = caseInfo.get(key);
            const status: CaseStatus =
              info
                ? getCaseStatus(ratings, raterId, item.model, item.dataset, info.caseId, info.sentenceCount)
                : "empty";
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;

            return (
              <button
                key={key}
                data-case-index={i}
                onClick={() => onSelect(i)}
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
                {/* Status dot */}
                <Icon className={`w-3 h-3 shrink-0 ${isSelected ? "text-primary" : cfg.dot}`} />

                {/* Case number */}
                <span
                  className={`
                    text-[11px] font-mono tabular-nums w-5 shrink-0
                    ${isSelected ? "font-bold text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {i}
                </span>

                {/* Model + dataset tag */}
                <span
                  className={`
                    text-[9px] truncate leading-tight
                    ${isSelected ? "text-foreground/70" : "text-muted-foreground/60"}
                  `}
                >
                  {shortModelName(item.model, metadata)} · {shortDatasetName(item.dataset)}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Keyboard nav hint */}
      <div className="px-3 py-2 border-t text-[9px] text-muted-foreground/50 shrink-0">
        <span className="font-mono">[</span>/<span className="font-mono">]</span> prev/next case
      </div>
    </div>
  );
}
