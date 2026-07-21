"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMetadata } from "@/hooks/useMetadata";
import { useLabelingState } from "@/hooks/useLabelingState";
import { useRaterIdentity } from "@/hooks/useRaterIdentity";
import { TRAINING_CASES } from "@/lib/sample-pool";
import { GoldStandardComparison, type GoldLabels } from "@/components/labeler/GoldStandardComparison";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import type { Case } from "@/lib/types";

type GoldStore = Record<string, GoldLabels>;

export default function TrainingPage() {
  const { metadata, isLoading: metaLoading } = useMetadata();
  const { ratings } = useLabelingState();
  const { raterId, raterName, isReady } = useRaterIdentity();

  const [selectedCase, setSelectedCase] = useState(0);
  const [cases, setCases] = useState<(Case | null)[]>([null, null, null]);
  const [goldStore, setGoldStore] = useState<GoldStore>({});
  const [isLoadingCases, setIsLoadingCases] = useState(true);

  // Load all 3 training case files
  useEffect(() => {
    async function loadCases() {
      const loaded = await Promise.all(
        TRAINING_CASES.map(async (tc) => {
          try {
            const res = await fetch(`/data/cases/${tc.model}_${tc.dataset}.json`);
            if (!res.ok) return null;
            const all = (await res.json()) as Case[];
            return all[tc.caseIndex] ?? null;
          } catch {
            return null;
          }
        })
      );
      setCases(loaded);
      setIsLoadingCases(false);
    }
    loadCases();
  }, []);

  // Load gold standard labels
  useEffect(() => {
    fetch("/data/training_gold.json")
      .then((r) => r.json())
      .then((data: GoldStore) => setGoldStore(data))
      .catch(() => {});
  }, []);

  const isLoading = metaLoading || isLoadingCases || !isReady;

  if (isLoading || !metadata) {
    return (
      <div className="flex h-full gap-0">
        <Skeleton className="w-44 h-full" />
        <Skeleton className="flex-1 h-full" />
      </div>
    );
  }

  const currentTraining = TRAINING_CASES[selectedCase];
  const currentCase = cases[selectedCase];
  const goldKey = `${currentTraining.model}_${currentTraining.dataset}_${currentTraining.caseIndex}`;
  const goldLabels: GoldLabels = goldStore[goldKey] ?? {};

  function shortModel(model: string) {
    return metadata!.models[model]?.display_name ?? model;
  }
  function shortDataset(dataset: string) {
    const map: Record<string, string> = {
      medqa: "MedQA",
      "medmcqa-filtered": "MCQ",
      "nejm-cpc": "NEJM",
    };
    return map[dataset] ?? dataset;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
        <Link
          href="/labeler"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-accent transition-colors text-muted-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Labeler
        </Link>

        <div className="text-xs font-semibold">Training Review</div>

        {raterName && (
          <div className="text-[10px] text-muted-foreground/60 border-l pl-3">
            {raterName}
          </div>
        )}

        <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-500 border border-blue-500/40 px-1.5 py-0.5 rounded">
          Training
        </span>

        <div className="flex-1" />

        <div className="text-[10px] text-muted-foreground/50 italic">
          Gold standard labels will appear once uploaded
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Case selector sidebar */}
        <div className="w-44 shrink-0 h-full border-r bg-muted/30 flex flex-col">
          <div className="px-3 py-2 border-b shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Training Cases
            </div>
          </div>
          <div className="py-1">
            {TRAINING_CASES.map((tc, i) => (
              <button
                key={i}
                onClick={() => setSelectedCase(i)}
                className={`
                  w-full text-left px-2.5 py-2 flex flex-col gap-0.5
                  transition-colors duration-100 border-l-2
                  ${selectedCase === i
                    ? "bg-accent border-l-primary"
                    : "hover:bg-accent/50 border-transparent"
                  }
                `}
              >
                <span className={`text-[11px] font-mono tabular-nums ${selectedCase === i ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                  Case {i}
                </span>
                <span className={`text-[9px] leading-tight ${selectedCase === i ? "text-foreground/70" : "text-muted-foreground/60"}`}>
                  {shortModel(tc.model)}
                </span>
                <span className={`text-[9px] leading-tight ${selectedCase === i ? "text-foreground/60" : "text-muted-foreground/40"}`}>
                  {shortDataset(tc.dataset)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {!currentCase ? (
          <div className="flex-1 p-4">
            <Skeleton className="h-full rounded-lg" />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Case prompt */}
            <div className="w-[35%] border-r overflow-hidden flex flex-col">
              <div className="px-4 py-2 border-b shrink-0">
                <div className="text-xs font-medium text-muted-foreground">Case Prompt</div>
                {currentCase.true_dx && (
                  <div className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">
                    Dx: {currentCase.true_dx}
                  </div>
                )}
              </div>
              <ScrollArea className="flex-1 px-4 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {currentCase.prompt}
                </p>
              </ScrollArea>
            </div>

            {/* Gold standard comparison */}
            <div className="flex-1 overflow-hidden">
              {raterId ? (
                <GoldStandardComparison
                  sentences={currentCase.sentences}
                  taxonomy={metadata.taxonomy}
                  ratings={ratings}
                  raterId={raterId}
                  model={currentTraining.model}
                  dataset={currentTraining.dataset}
                  caseId={currentCase.id}
                  goldLabels={goldLabels}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Sign in via the labeler to see your labels.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
