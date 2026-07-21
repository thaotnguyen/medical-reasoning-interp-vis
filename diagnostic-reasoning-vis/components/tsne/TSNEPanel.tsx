"use client";

import { useState, useEffect, useCallback } from "react";
import { zoomIdentity } from "d3-zoom";
import { scaleLinear } from "d3-scale";
import { TSNECanvas, type TSNEScales } from "./TSNECanvas";
import { TrajectoryOverlay } from "./TrajectoryOverlay";
import { TSNETooltip } from "./TSNETooltip";
import { TSNELegend } from "./TSNELegend";
import { Skeleton } from "@/components/ui/skeleton";
import type { TSNEPoint, TaxonomyItem, ClusterInfo, Case } from "@/lib/types";

interface TSNEPanelProps {
  points: TSNEPoint[] | null;
  isLoading: boolean;
  taxonomy: TaxonomyItem[];
  clusters: Record<string, ClusterInfo>;
  cases: Case[] | undefined;
  colorMode: "taxonomy" | "cluster";
  onColorModeChange: (mode: "taxonomy" | "cluster") => void;
  activeCaseIdx: number | null;
  hoveredPointIdx: number | null;
  hoveredSentenceIdx: number | null;
  onHoverPoint: (index: number | null) => void;
  onClickPoint: (caseIdx: number, sentIdx: number) => void;
  trajectoryPlaying: boolean;
  onPlayTrajectory: () => void;
  onTrajectoryPlayComplete: () => void;
}

const defaultScales: TSNEScales = {
  scaleX: scaleLinear<number, number>(),
  scaleY: scaleLinear<number, number>(),
  transform: zoomIdentity,
};

export function TSNEPanel({
  points,
  isLoading,
  taxonomy,
  clusters,
  cases,
  colorMode,
  onColorModeChange,
  activeCaseIdx,
  hoveredPointIdx,
  hoveredSentenceIdx,
  onHoverPoint,
  onClickPoint,
  trajectoryPlaying,
  onPlayTrajectory,
  onTrajectoryPlayComplete,
}: TSNEPanelProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scales, setScales] = useState<TSNEScales>(defaultScales);
  // Matches Tailwind's `md` breakpoint, which is where the layout switches.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const handleHoverPoint = useCallback(
    (index: number | null) => {
      onHoverPoint(index);
    },
    [onHoverPoint]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleScalesChange = useCallback((s: TSNEScales) => {
    setScales(s);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Skeleton className="flex-1 m-3 rounded-lg" />
      </div>
    );
  }

  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No activation data available for this model/dataset
      </div>
    );
  }

  const hoveredPoint =
    hoveredPointIdx !== null ? points[hoveredPointIdx] : null;

  const currentCase =
    activeCaseIdx !== null ? cases?.[activeCaseIdx] : undefined;

  return (
    // Phones: the canvas spans the whole panel and the legend floats over its right side,
    // so zoomed points can travel underneath it. The plot still *opens* as a left-hand
    // square (fitSquare). Desktop keeps the plot above a full-width legend strip.
    <div
      className="relative flex flex-col h-full min-h-0"
      onMouseMove={handleMouseMove}
    >
      {/* Canvas + trajectory overlay */}
      <div className="relative overflow-hidden flex-1 min-h-0">
        <TSNECanvas
          points={points}
          taxonomy={taxonomy}
          clusters={clusters}
          colorMode={colorMode}
          activeCaseIdx={activeCaseIdx}
          hoveredIdx={hoveredPointIdx}
          hoveredSentenceIdx={hoveredSentenceIdx}
          onHoverPoint={handleHoverPoint}
          onClickPoint={onClickPoint}
          onScalesChange={handleScalesChange}
          fitSquare={isNarrow}
        />

        {/* Trajectory overlay */}
        {currentCase && (
          <TrajectoryOverlay
            sentences={currentCase.sentences}
            scaleX={scales.scaleX}
            scaleY={scales.scaleY}
            transform={scales.transform}
            hoveredSentenceIndex={hoveredSentenceIdx}
            isPlaying={trajectoryPlaying}
            onPlayComplete={onTrajectoryPlayComplete}
          />
        )}

        {/* Tooltip */}
        {hoveredPoint && (
          <TSNETooltip
            point={hoveredPoint}
            colorMode={colorMode}
            taxonomy={taxonomy}
            clusters={clusters}
            cases={cases}
            mouseX={mousePos.x}
            mouseY={mousePos.y}
          />
        )}
      </div>

      {/* Legend: floating card over the plot on phones, strip underneath on desktop. Two
          instances rather than one, because the stacked-vs-wrapped arrangement is a
          different DOM shape, not something a responsive utility class can toggle.
          The 0.9 alpha sits on the card background only, so the swatches and text on top
          of it stay fully opaque. pointer-events-none keeps the plot draggable underneath. */}
      <div className="md:hidden absolute top-1.5 right-1.5 z-10 max-w-[52%] max-h-[calc(100%-0.75rem)] overflow-y-auto rounded-md border border-black/10 bg-white/90 shadow-sm pointer-events-none">
        <TSNELegend
          colorMode={colorMode}
          taxonomy={taxonomy}
          clusters={clusters}
          layout="column"
          opaque
        />
      </div>
      <div className="hidden md:block border-t shrink-0">
        <TSNELegend
          colorMode={colorMode}
          taxonomy={taxonomy}
          clusters={clusters}
        />
      </div>
    </div>
  );
}
