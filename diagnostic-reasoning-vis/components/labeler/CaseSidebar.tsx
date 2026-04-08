"use client";

import { useRef, useEffect, useMemo } from "react";
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

function CaseRow({
  item,
  poolIndex,
  isSelected,
  status,
  metadata,
  onSelect,
}: {
  item: SampleItem;
  poolIndex: number;
  isSelected: boolean;
  status: CaseStatus;
  metadata: Metadata;
  onSelect: (index: number) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const key = `${item.model}_${item.dataset}_${item.caseIndex}`;

  return (
    <button
      key={key}
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
        className={`
          text-[11px] font-mono tabular-nums w-5 shrink-0
          ${isSelected ? "font-bold text-foreground" : "text-muted-foreground"}
        `}
      >
        {poolIndex}
      </span>
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
    const vpTop = viewport.scrollTop;
    const vpBottom = vpTop + viewport.clientHeight;

    if (elTop < vpTop) {
      viewport.scrollTop = elTop;
    } else if (elBottom > vpBottom) {
      viewport.scrollTop = elBottom - viewport.clientHeight;
    }
  }, [selectedIndex]);

  const trainingPool = pool.filter(
    (item) => getPoolPhase(item.index, item.isTraining) === "training"
  );
  const testPool = pool.filter(
    (item) => getPoolPhase(item.index, item.isTraining) === "test"
  );

  // Progress counts test cases only
  const { completed, partial } = useMemo(() => {
    let completed = 0;
    let partial = 0;
    for (const item of testPool) {
      const key = `${item.model}_${item.dataset}_${item.caseIndex}`;
      const info = caseInfo.get(key);
      if (!info) continue;
      const status = getCaseStatus(ratings, raterId, item.model, item.dataset, info.caseId, info.sentenceCount);
      if (status === "complete") completed++;
      else if (status === "partial") partial++;
    }
    return { completed, partial };
  }, [testPool, ratings, raterId, caseInfo]);

  const totalTest = testPool.length;

  function getStatus(item: SampleItem): CaseStatus {
    const key = `${item.model}_${item.dataset}_${item.caseIndex}`;
    const info = caseInfo.get(key);
    if (!info) return "empty";
    return getCaseStatus(ratings, raterId, item.model, item.dataset, info.caseId, info.sentenceCount);
  }

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      {/* Header */}
      <div className="px-3 py-2.5 border-b shrink-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cases
        </div>
        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
          {completed > 0 || partial > 0
            ? `${completed} done · ${partial} in progress · ${totalTest - completed - partial} remaining`
            : `${totalTest} to label`}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="py-1">
          {/* Training section */}
          <div className="px-2.5 pt-2 pb-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-500/70">
              Training
            </span>
          </div>
          {trainingPool.map((item) => (
            <CaseRow
              key={`${item.model}_${item.dataset}_${item.caseIndex}`}
              item={item}
              poolIndex={item.index}
              isSelected={item.index === selectedIndex}
              status={getStatus(item)}
              metadata={metadata}
              onSelect={onSelect}
            />
          ))}
          {/* Test section */}
          <div className="px-2.5 pt-3 pb-1">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Test
            </span>
          </div>
          {testPool.map((item) => (
            <CaseRow
              key={`${item.model}_${item.dataset}_${item.caseIndex}`}
              item={item}
              poolIndex={item.index}
              isSelected={item.index === selectedIndex}
              status={getStatus(item)}
              metadata={metadata}
              onSelect={onSelect}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Keyboard nav hint */}
      <div className="px-3 py-2 border-t text-[9px] text-muted-foreground/50 shrink-0">
        <span className="font-mono">[</span>/<span className="font-mono">]</span> prev/next case
      </div>
    </div>
  );
}
