"use client";

import { useCallback, useState } from "react";
import { useMetadata } from "@/hooks/useMetadata";
import { usePipelineCases } from "@/hooks/usePipelineCases";
import { usePipelinePoints } from "@/hooks/usePipelinePoints";
import { usePipelineTaxonomy } from "@/hooks/usePipelineTaxonomy";
import { useAppState } from "@/hooks/useAppState";
import { TSNEPanel } from "@/components/tsne/TSNEPanel";
import { CasePanel } from "@/components/case/CasePanel";
import { TracePanel } from "@/components/trace/TracePanel";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExplorerPage() {
  const [caseOpen, setCaseOpen] = useState(true);
  const { metadata, isLoading: metaLoading } = useMetadata();
  const {
    selectedPipeline,
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

  const { cases, isLoading: casesLoading } = usePipelineCases(
    selectedPipeline,
    selectedModel,
    selectedDataset
  );
  const { taxonomy } = usePipelineTaxonomy(selectedPipeline);

  const modelInfo = metadata?.models[selectedModel];
  const hasTSNE = true;
  const tsneEnabled = true;
  const { points, isLoading: tsneLoading } = usePipelinePoints(
    selectedPipeline,
    selectedModel,
    tsneEnabled
  );

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
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* Left: t-SNE panel */}
      {hasTSNE && (
        <div
          /* Phones: compact fixed-height strip (square plot + legend beside it).
             Desktop: the plot stays the dominant pane. */
          className="h-[190px] shrink-0 md:h-auto md:flex-[3] border-b md:border-b-0 md:border-r overflow-hidden min-h-0"
        >
          <TSNEPanel
            points={points}
            isLoading={tsneLoading}
            taxonomy={taxonomy.length ? taxonomy : metadata.taxonomy}
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
        className={`${hasTSNE ? "flex-[2]" : "flex-1 max-w-4xl mx-auto"} flex flex-col overflow-hidden min-h-0`}
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
            {/* Collapsing the prompt has to release the reserved height too, so the
                open state lives here rather than inside CasePanel. */}
            <div
              className={`${caseOpen ? "h-[35%]" : "shrink-0"} border-b overflow-hidden`}
            >
              <CasePanel
                cases={cases}
                selectedIndex={selectedCaseIndex}
                onSelect={navigateToCase}
                open={caseOpen}
                onOpenChange={setCaseOpen}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              {currentCase && (
                <TracePanel
                  currentCase={currentCase}
                  taxonomy={taxonomy.length ? taxonomy : metadata.taxonomy}
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
