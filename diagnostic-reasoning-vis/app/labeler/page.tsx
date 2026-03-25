"use client";

import { useCallback, useState } from "react";
import { useMetadata } from "@/hooks/useMetadata";
import { useCases } from "@/hooks/useCases";
import { useAppState } from "@/hooks/useAppState";
import { useLabelingState, getRating } from "@/hooks/useLabelingState";
import { useKeyboardLabeling } from "@/hooks/useKeyboardLabeling";
import { useRaterIdentity } from "@/hooks/useRaterIdentity";
import { useRatingsSync } from "@/hooks/useRatingsSync";
import { CasePanel } from "@/components/case/CasePanel";
import { LabelingPanel } from "@/components/labeler/LabelingPanel";
import { TutorialModal } from "@/components/labeler/TutorialModal";
import { HelpDrawer } from "@/components/labeler/HelpDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, User } from "lucide-react";

export default function LabelerPage() {
  const { metadata, isLoading: metaLoading } = useMetadata();
  const {
    selectedModel,
    selectedDataset,
    selectedCaseIndex,
    navigateToCase,
  } = useAppState();

  const { cases, isLoading: casesLoading } = useCases(
    selectedModel,
    selectedDataset
  );

  const {
    ratings,
    focusedSentenceIndex,
    setFocusedSentence,
    setRating,
    clearRating,
  } = useLabelingState();

  const {
    raterId,
    raterName,
    needsTutorial,
    isReady,
    completeTutorial,
  } = useRaterIdentity();

  const [helpOpen, setHelpOpen] = useState(false);

  // Sync ratings to server
  useRatingsSync({
    raterId,
    raterName,
    ratings,
    enabled: !!raterId,
  });

  const currentCase = cases?.[selectedCaseIndex];

  // Auto-advance: find next unlabeled sentence after labeling
  const findNextUnlabeled = useCallback(
    (from: number): number => {
      if (!raterId || !currentCase) return from;
      const total = currentCase.sentences.length;
      for (let i = 1; i <= total; i++) {
        const idx = (from + i) % total;
        if (!getRating(ratings, raterId, selectedModel, selectedDataset, currentCase.id, idx)) {
          return idx;
        }
      }
      // All labeled: just advance to next
      return Math.min(from + 1, total - 1);
    },
    [raterId, currentCase, ratings, selectedModel, selectedDataset]
  );

  const handleLabel = useCallback(
    (sentIdx: number, taxonomy: number) => {
      if (!raterId || !currentCase) return;
      setRating(raterId, selectedModel, selectedDataset, currentCase.id, sentIdx, taxonomy);
      // Auto-advance to next unlabeled
      const next = findNextUnlabeled(sentIdx);
      setFocusedSentence(next);
    },
    [raterId, currentCase, selectedModel, selectedDataset, setRating, findNextUnlabeled, setFocusedSentence]
  );

  const handleClear = useCallback(
    (sentIdx: number) => {
      if (!raterId || !currentCase) return;
      clearRating(raterId, selectedModel, selectedDataset, currentCase.id, sentIdx);
    },
    [raterId, currentCase, selectedModel, selectedDataset, clearRating]
  );

  const handleCaseNavigate = useCallback(
    (idx: number) => {
      navigateToCase(idx);
      setFocusedSentence(0);
    },
    [navigateToCase, setFocusedSentence]
  );

  const handleTutorialComplete = useCallback(
    (name: string) => {
      completeTutorial(name);
    },
    [completeTutorial]
  );

  useKeyboardLabeling({
    enabled: !!raterId && !!currentCase && !needsTutorial && !helpOpen,
    rater: raterId,
    model: selectedModel,
    dataset: selectedDataset,
    caseId: currentCase?.id ?? "",
    ratings,
    totalSentences: currentCase?.sentences.length ?? 0,
    focusedIndex: focusedSentenceIndex,
    onFocus: setFocusedSentence,
    onLabel: handleLabel,
    onClear: handleClear,
    onToggleHelp: () => setHelpOpen((v) => !v),
  });

  if (metaLoading || !metadata || !isReady) {
    return (
      <div className="flex h-full gap-4 p-4">
        <Skeleton className="flex-1 h-full rounded-lg" />
        <Skeleton className="flex-[2] h-full rounded-lg" />
      </div>
    );
  }

  // Show tutorial on first visit
  if (needsTutorial) {
    return (
      <TutorialModal
        taxonomy={metadata.taxonomy}
        onComplete={handleTutorialComplete}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b shrink-0">
        {/* Rater identity badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium">{raterName}</span>
        </div>

        {/* Case switcher */}
        {cases && (
          <div className="flex-1 max-w-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Case
              </span>
              <select
                className="flex-1 h-8 text-xs border rounded-md px-2 bg-background"
                value={selectedCaseIndex}
                onChange={(e) => handleCaseNavigate(Number(e.target.value))}
              >
                {cases.map((c, i) => (
                  <option key={c.id} value={i}>
                    #{i + 1} - {c.true_dx} {c.correct ? "\u2713" : "\u2717"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Help button */}
        <button
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border hover:bg-accent transition-colors"
          title="Category reference (keyboard: ?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Help
        </button>
      </div>

      {/* Main content */}
      {casesLoading || !cases || !currentCase || !raterId ? (
        <div className="flex-1 p-4">
          <Skeleton className="h-full rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Case prompt */}
          <div className="w-[35%] border-r overflow-hidden">
            <CasePanel
              cases={cases}
              selectedIndex={selectedCaseIndex}
              onSelect={handleCaseNavigate}
            />
          </div>

          {/* Right: Labeling panel */}
          <div className="flex-1 overflow-hidden">
            <LabelingPanel
              sentences={currentCase.sentences}
              taxonomy={metadata.taxonomy}
              ratings={ratings}
              rater={raterId}
              model={selectedModel}
              dataset={selectedDataset}
              caseId={currentCase.id}
              focusedIndex={focusedSentenceIndex}
              onFocus={setFocusedSentence}
              onLabel={handleLabel}
              onClear={handleClear}
            />
          </div>
        </div>
      )}

      {/* Help drawer */}
      <HelpDrawer
        taxonomy={metadata.taxonomy}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}
