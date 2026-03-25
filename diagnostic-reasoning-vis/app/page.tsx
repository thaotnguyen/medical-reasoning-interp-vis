"use client";

import { useCallback } from "react";
import { useMetadata } from "@/hooks/useMetadata";
import { useCases } from "@/hooks/useCases";
import { useTSNE } from "@/hooks/useTSNE";
import { useAppState } from "@/hooks/useAppState";
import { TSNEPanel } from "@/components/tsne/TSNEPanel";
import { CasePanel } from "@/components/case/CasePanel";
import { TracePanel } from "@/components/trace/TracePanel";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExplorerPage() {
  const { metadata, isLoading: metaLoading } = useMetadata();
  const {
    selectedModel,
    selectedDataset,
    selectedCaseIndex,
    colorMode,
    setColorMode,
    hoveredPointIndex,
    setHoveredPoint,
    hoveredSentenceIndex,
    setHoveredSentence,
    navigateToCase,
    trajectoryPlaying,
    setTrajectoryPlaying,
  } = useAppState();

  const { cases, isLoading: casesLoading } = useCases(
    selectedModel,
    selectedDataset
  );

  const modelInfo = metadata?.models[selectedModel];
  const datasetInfo = modelInfo?.datasets[selectedDataset];
  const hasTSNE = datasetInfo?.has_tsne ?? false;

  // Only fetch t-SNE if model has activations and dataset supports it
  const tsneModel =
    hasTSNE && modelInfo?.has_activations ? selectedModel : null;
  const { points, isLoading: tsneLoading } = useTSNE(tsneModel);

  const handleClickPoint = useCallback(
    (caseIdx: number) => {
      navigateToCase(caseIdx);
    },
    [navigateToCase]
  );

  const handlePlayTrajectory = useCallback(() => {
    setTrajectoryPlaying(true);
  }, [setTrajectoryPlaying]);

  const handleTrajectoryPlayComplete = useCallback(() => {
    setTrajectoryPlaying(false);
  }, [setTrajectoryPlaying]);

  if (metaLoading || !metadata) {
    return (
      <div className="flex h-full gap-4 p-4">
        <Skeleton className="flex-[3] h-full rounded-lg" />
        <Skeleton className="flex-[2] h-full rounded-lg" />
      </div>
    );
  }

  const currentCase = cases?.[selectedCaseIndex];

  return (
    <div className="flex h-full">
      {/* Left: t-SNE panel */}
      {hasTSNE && (
        <div className="flex-[3] border-r overflow-hidden">
          <TSNEPanel
            points={points}
            isLoading={tsneLoading}
            taxonomy={metadata.taxonomy}
            clusters={modelInfo?.clusters ?? {}}
            cases={cases}
            colorMode={colorMode}
            onColorModeChange={setColorMode}
            activeCaseIdx={selectedCaseIndex}
            hoveredPointIdx={hoveredPointIndex}
            hoveredSentenceIdx={hoveredSentenceIndex}
            onHoverPoint={setHoveredPoint}
            onClickPoint={handleClickPoint}
            trajectoryPlaying={trajectoryPlaying}
            onPlayTrajectory={handlePlayTrajectory}
            onTrajectoryPlayComplete={handleTrajectoryPlayComplete}
          />
        </div>
      )}

      {/* Right: Case + Trace panels */}
      <div
        className={`${hasTSNE ? "flex-[2]" : "flex-1 max-w-4xl mx-auto"} flex flex-col overflow-hidden`}
      >
        {casesLoading || !cases ? (
          <div className="flex-1 p-4">
            <Skeleton className="h-6 w-48 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <>
            <div className="h-[35%] border-b overflow-hidden">
              <CasePanel
                cases={cases}
                selectedIndex={selectedCaseIndex}
                onSelect={navigateToCase}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              {currentCase && (
                <TracePanel
                  currentCase={currentCase}
                  taxonomy={metadata.taxonomy}
                  hoveredSentenceIndex={hoveredSentenceIndex}
                  onHoverSentence={setHoveredSentence}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
