"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useMetadata } from "@/hooks/useMetadata";
import { useSamplePool } from "@/hooks/useSamplePool";
import { useLabelingState, getRating } from "@/hooks/useLabelingState";
import { useKeyboardLabeling } from "@/hooks/useKeyboardLabeling";
import { useRaterIdentity } from "@/hooks/useRaterIdentity";
import { useRatingsSync } from "@/hooks/useRatingsSync";
import { CaseSidebar } from "@/components/labeler/CaseSidebar";
import { LabelingPanel } from "@/components/labeler/LabelingPanel";
import { TutorialModal } from "@/components/labeler/TutorialModal";
import { HelpDrawer } from "@/components/labeler/HelpDrawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HelpCircle,
  User,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import type { CasePoolInfo } from "@/lib/labeling-types";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function LabelerPage() {
  const { metadata, isLoading: metaLoading } = useMetadata();

  // Cache: "model_dataset_caseIndex" -> { sentenceCount, caseId }
  // Must be declared before useSamplePool so the callback can be passed in.
  const caseInfoRef = useRef<Map<string, CasePoolInfo>>(new Map());
  const [caseInfo, setCaseInfo] = useState<Map<string, CasePoolInfo>>(new Map());

  // When an entire cases file is loaded, populate caseInfo for every case in it.
  // This means sidebar status is correct for all cases in the file immediately,
  // not just the one currently being viewed.
  const handleCasesLoaded = useCallback(
    (model: string, dataset: string, cases: import("@/lib/types").Case[]) => {
      const map = caseInfoRef.current;
      let changed = false;
      cases.forEach((c, idx) => {
        const key = `${model}_${dataset}_${idx}`;
        const existing = map.get(key);
        if (existing?.caseId !== c.id || existing?.sentenceCount !== c.sentences.length) {
          map.set(key, { sentenceCount: c.sentences.length, caseId: c.id });
          changed = true;
        }
      });
      if (changed) setCaseInfo(new Map(map));
    },
    []
  );

  const {
    pool,
    currentItem,
    currentCase,
    selectedIndex,
    isLoading: poolLoading,
    navigateTo,
  } = useSamplePool({ onCasesLoaded: handleCasesLoaded });

  const {
    ratings,
    focusedSentenceIndex,
    setFocusedSentence,
    setRating,
    clearRating,
    importRatings,
  } = useLabelingState();

  const {
    raterId,
    raterName,
    needsTutorial,
    isReady,
    completeTutorial,
  } = useRaterIdentity();

  const [helpOpen, setHelpOpen] = useState(false);
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  // On desktop, sidebar is always visible; on mobile, collapsed by default
  // When switching to mobile, close sidebar and prompt
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setPromptOpen(false);
    }
  }, [isMobile]);

  // Pull server ratings on startup, push local changes to server
  const handleServerData = useCallback(
    (serverRatings: import("@/lib/labeling-types").RatingsStore) => {
      importRatings(serverRatings);
    },
    [importRatings]
  );

  useRatingsSync({
    raterId,
    raterName,
    ratings,
    enabled: !!raterId,
    onServerData: handleServerData,
  });

  // Auto-advance: find next unlabeled sentence after labeling
  const findNextUnlabeled = useCallback(
    (from: number): number => {
      if (!raterId || !currentCase || !currentItem) return from;
      const total = currentCase.sentences.length;
      for (let i = 1; i <= total; i++) {
        const idx = (from + i) % total;
        if (
          !getRating(
            ratings,
            raterId,
            currentItem.model,
            currentItem.dataset,
            currentCase.id,
            idx
          )
        ) {
          return idx;
        }
      }
      return Math.min(from + 1, total - 1);
    },
    [raterId, currentCase, currentItem, ratings]
  );

  const handleLabel = useCallback(
    (sentIdx: number, taxonomy: number) => {
      if (!raterId || !currentCase || !currentItem) return;
      setRating(
        raterId,
        currentItem.model,
        currentItem.dataset,
        currentCase.id,
        sentIdx,
        taxonomy
      );
      const next = findNextUnlabeled(sentIdx);
      setFocusedSentence(next);
    },
    [raterId, currentCase, currentItem, setRating, findNextUnlabeled, setFocusedSentence]
  );

  const handleClear = useCallback(
    (sentIdx: number) => {
      if (!raterId || !currentCase || !currentItem) return;
      clearRating(raterId, currentItem.model, currentItem.dataset, currentCase.id, sentIdx);
    },
    [raterId, currentCase, currentItem, clearRating]
  );

  const handleCaseNavigate = useCallback(
    (idx: number) => {
      navigateTo(idx);
      setFocusedSentence(0);
      // Close mobile overlays on navigation
      if (isMobile) setSidebarOpen(false);
    },
    [navigateTo, setFocusedSentence, isMobile]
  );

  const handleTutorialComplete = useCallback(
    (name: string) => {
      completeTutorial(name);
    },
    [completeTutorial]
  );

  // Case-level keyboard navigation: [ and ] for prev/next case
  useEffect(() => {
    if (!raterId || needsTutorial || helpOpen) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "[") {
        e.preventDefault();
        handleCaseNavigate(Math.max(0, selectedIndex - 1));
      } else if (e.key === "]") {
        e.preventDefault();
        handleCaseNavigate(Math.min(pool.length - 1, selectedIndex + 1));
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [raterId, needsTutorial, helpOpen, selectedIndex, pool.length, handleCaseNavigate]);

  useKeyboardLabeling({
    enabled: !!raterId && !!currentCase && !!currentItem && !needsTutorial && !helpOpen,
    rater: raterId,
    model: currentItem?.model ?? "",
    dataset: currentItem?.dataset ?? "",
    caseId: currentCase?.id ?? "",
    ratings,
    totalSentences: currentCase?.sentences.length ?? 0,
    focusedIndex: focusedSentenceIndex,
    onFocus: setFocusedSentence,
    onLabel: handleLabel,
    onClear: handleClear,
    onToggleHelp: () => setHelpOpen((v) => !v),
  });

  // Loading state
  if (metaLoading || !metadata || !isReady) {
    return (
      <div className="flex h-full gap-0">
        <Skeleton className="w-48 h-full" />
        <Skeleton className="flex-1 h-full" />
      </div>
    );
  }

  // Tutorial
  if (needsTutorial) {
    return (
      <TutorialModal
        taxonomy={metadata.taxonomy}
        onComplete={handleTutorialComplete}
      />
    );
  }

  // Model/dataset display names
  const modelName = currentItem
    ? metadata.models[currentItem.model]?.display_name ?? currentItem.model
    : "";
  const datasetName = currentItem
    ? metadata.datasets[currentItem.dataset] ?? currentItem.dataset
    : "";

  const showSidebar = isMobile ? sidebarOpen : true;
  const showPrompt = isMobile ? promptOpen : true;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 border-b shrink-0">
        {/* Mobile sidebar toggle */}
        {isMobile && raterId && (
          <button
            onClick={() => { setSidebarOpen((v) => !v); setPromptOpen(false); }}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Toggle case list"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        )}

        {/* Rater badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium">{raterName}</span>
        </div>

        {/* Case nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleCaseNavigate(selectedIndex - 1)}
            disabled={selectedIndex === 0}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums px-1">
            <span className="font-semibold">{selectedIndex}</span>
            <span className="text-muted-foreground"> / {pool.length - 1}</span>
          </span>
          <button
            onClick={() => handleCaseNavigate(selectedIndex + 1)}
            disabled={selectedIndex >= pool.length - 1}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile prompt toggle */}
        {isMobile && currentCase && (
          <button
            onClick={() => { setPromptOpen((v) => !v); setSidebarOpen(false); }}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${promptOpen ? "bg-accent" : ""}`}
            title="Toggle case prompt"
          >
            <FileText className="w-4 h-4" />
          </button>
        )}

        {/* Source info — hide on mobile */}
        {currentItem && (
          <div className="hidden md:flex items-center gap-2 border-l pl-3">
            <span className="text-[10px] text-muted-foreground/60">
              {modelName} · {datasetName}
            </span>
            {currentItem.isTraining && (
              <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-500 border border-blue-500/40 px-1.5 py-0.5 rounded">
                Training
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Training review link */}
        <Link
          href="/training"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border hover:bg-accent transition-colors"
          title="Review training cases with gold standard"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Training
        </Link>

        {/* Help button */}
        <button
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border hover:bg-accent transition-colors"
          title="Category reference (keyboard: ?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Help</span>
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar — overlay on mobile, inline on desktop */}
        {raterId && showSidebar && (
          <>
            {isMobile && (
              <div
                className="absolute inset-0 bg-black/30 z-20"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <div className={`
              ${isMobile ? "absolute left-0 top-0 bottom-0 z-30 w-56 shadow-xl" : "w-52"}
              shrink-0 h-full overflow-hidden bg-background
            `}>
              <CaseSidebar
                pool={pool}
                metadata={metadata}
                selectedIndex={selectedIndex}
                onSelect={handleCaseNavigate}
                ratings={ratings}
                raterId={raterId}
                caseInfo={caseInfo}
              />
            </div>
          </>
        )}

        {/* Content area */}
        {poolLoading || !currentCase || !currentItem || !raterId ? (
          <div className="flex-1 p-4">
            <Skeleton className="h-full rounded-lg" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Case prompt — overlay on mobile, inline on desktop */}
            {showPrompt && (
              <>
                {isMobile && (
                  <div
                    className="absolute inset-0 bg-black/30 z-20"
                    onClick={() => setPromptOpen(false)}
                  />
                )}
                <div className={`
                  ${isMobile
                    ? "absolute left-0 top-0 bottom-0 z-30 w-[85%] max-w-sm shadow-xl bg-background"
                    : "w-[35%] border-r"
                  }
                  overflow-hidden flex flex-col
                `}>
                  <div className="px-4 py-2 border-b shrink-0 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Case Prompt</div>
                      {currentCase.true_dx && (
                        <div className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">
                          Dx: {currentCase.true_dx}
                        </div>
                      )}
                    </div>
                    {isMobile && (
                      <button
                        onClick={() => setPromptOpen(false)}
                        className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <ScrollArea className="flex-1 min-h-0 px-4 py-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {currentCase.prompt}
                    </p>
                  </ScrollArea>
                </div>
              </>
            )}

            {/* Labeling panel */}
            <div className="flex-1 overflow-hidden">
              <LabelingPanel
                sentences={currentCase.sentences}
                taxonomy={metadata.taxonomy}
                ratings={ratings}
                rater={raterId}
                model={currentItem.model}
                dataset={currentItem.dataset}
                caseId={currentCase.id}
                focusedIndex={focusedSentenceIndex}
                onFocus={setFocusedSentence}
                onLabel={handleLabel}
                onClear={handleClear}
              />
            </div>
          </div>
        )}
      </div>

      {/* Help drawer */}
      <HelpDrawer
        taxonomy={metadata.taxonomy}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}
