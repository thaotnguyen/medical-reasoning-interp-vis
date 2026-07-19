"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { scaleLinear, type ScaleLinear } from "d3-scale";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import { schemeTableau10 } from "d3-scale-chromatic";
import { renderBase, renderHover } from "@/lib/tsne-renderer";
import { findNearestPointLinear } from "@/lib/quadtree";
import type { TSNEPoint, TaxonomyItem, ClusterInfo } from "@/lib/types";

export interface TSNEScales {
  scaleX: ScaleLinear<number, number>;
  scaleY: ScaleLinear<number, number>;
  transform: ZoomTransform;
}

interface TSNECanvasProps {
  points: TSNEPoint[];
  taxonomy: TaxonomyItem[];
  clusters: Record<string, ClusterInfo>;
  colorMode: "taxonomy" | "cluster";
  activeCaseIdx: number | null;
  hoveredIdx: number | null;
  hoveredSentenceIdx: number | null;
  onHoverPoint: (index: number | null) => void;
  onClickPoint: (caseIdx: number, sentIdx: number) => void;
  onScalesChange?: (scales: TSNEScales) => void;
}

export function TSNECanvas({
  points,
  taxonomy,
  clusters,
  colorMode,
  activeCaseIdx,
  hoveredIdx,
  hoveredSentenceIdx,
  onHoverPoint,
  onClickPoint,
  onScalesChange,
}: TSNECanvasProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const baseRafRef = useRef<number>(0);
  const overlayRafRef = useRef<number>(0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const lastHoverRef = useRef<number | null>(null);
  // Stable indirection so the resize/zoom subscriptions never depend on the hover-changing
  // schedule callbacks (re-subscribing a ResizeObserver resets canvas.width, which clears the
  // canvas and caused the hover flicker).
  const scheduleBaseRef = useRef<() => void>(() => {});
  const scheduleOverlayRef = useRef<() => void>(() => {});

  const taxonomyColors = useMemo(
    () => taxonomy.map((t) => t.color),
    [taxonomy]
  );

  const clusterColorMap = useMemo(() => {
    const map = new Map<number, string>();
    const clusterIds = Object.keys(clusters)
      .map(Number)
      .sort((a, b) => a - b);
    clusterIds.forEach((id, i) => {
      map.set(id, schemeTableau10[i % 10]);
    });
    map.set(-1, "#94a3b8");
    return map;
  }, [clusters]);

  // Compute scales from point extents
  const { scaleX, scaleY } = useMemo(() => {
    if (points.length === 0) {
      return {
        scaleX: scaleLinear().domain([0, 1]).range([0, 1]),
        scaleY: scaleLinear().domain([0, 1]).range([0, 1]),
      };
    }
    let xMin = Infinity,
      xMax = -Infinity,
      yMin = Infinity,
      yMax = -Infinity;
    for (const p of points) {
      if (p[0] < xMin) xMin = p[0];
      if (p[0] > xMax) xMax = p[0];
      if (p[1] < yMin) yMin = p[1];
      if (p[1] > yMax) yMax = p[1];
    }
    const pad = 0.05;
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const { width, height } = sizeRef.current;
    const margin = 20;

    return {
      scaleX: scaleLinear()
        .domain([xMin - xRange * pad, xMax + xRange * pad])
        .range([margin, (width || 600) - margin]),
      scaleY: scaleLinear()
        .domain([yMin - yRange * pad, yMax + yRange * pad])
        .range([margin, (height || 600) - margin]),
    };
  }, [points]);

  // Report initial scales to parent
  useEffect(() => {
    onScalesChange?.({ scaleX, scaleY, transform: transformRef.current });
  }, [scaleX, scaleY, onScalesChange]);

  // --- Base layer: all points, hover-independent (redraws only on data/zoom/active change) ---
  const drawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    renderBase({
      ctx,
      width: sizeRef.current.width,
      height: sizeRef.current.height,
      points,
      scaleX,
      scaleY,
      colorMode,
      taxonomyColors,
      clusterColorMap,
      activeCaseIdx,
      transform: transformRef.current,
      dpr: window.devicePixelRatio || 1,
    });
  }, [points, scaleX, scaleY, colorMode, taxonomyColors, clusterColorMap, activeCaseIdx]);

  // --- Overlay layer: only the hovered point (cheap redraw on every hover) ---
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    // A sentence hovered in the trace maps to its point in the active case.
    let effectiveHoveredIdx = hoveredIdx;
    if (hoveredSentenceIdx !== null && activeCaseIdx !== null) {
      for (let i = 0; i < points.length; i++) {
        if (points[i][4] === activeCaseIdx && points[i][5] === hoveredSentenceIdx) {
          effectiveHoveredIdx = i;
          break;
        }
      }
    }

    renderHover({
      ctx,
      width: sizeRef.current.width,
      height: sizeRef.current.height,
      points,
      scaleX,
      scaleY,
      colorMode,
      taxonomyColors,
      clusterColorMap,
      hoveredIdx: effectiveHoveredIdx,
      transform: transformRef.current,
      dpr: window.devicePixelRatio || 1,
    });
  }, [points, scaleX, scaleY, colorMode, taxonomyColors, clusterColorMap, hoveredIdx, hoveredSentenceIdx, activeCaseIdx]);

  const scheduleBase = useCallback(() => {
    cancelAnimationFrame(baseRafRef.current);
    baseRafRef.current = requestAnimationFrame(drawBase);
  }, [drawBase]);

  const scheduleOverlay = useCallback(() => {
    cancelAnimationFrame(overlayRafRef.current);
    overlayRafRef.current = requestAnimationFrame(drawOverlay);
  }, [drawOverlay]);

  // Keep the refs pointing at the latest schedulers without re-subscribing observers.
  scheduleBaseRef.current = scheduleBase;
  scheduleOverlayRef.current = scheduleOverlay;

  // Resize observer: set up ONCE. Resetting canvas.width clears the canvas, so this must not
  // re-run on hover — it calls the schedulers through refs instead of depending on them.
  useEffect(() => {
    const container = containerRef.current;
    const base = baseCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!container || !base || !overlay) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      sizeRef.current = { width, height };
      const dpr = window.devicePixelRatio || 1;
      for (const canvas of [base, overlay]) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      scheduleBaseRef.current();
      scheduleOverlayRef.current();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Zoom behavior (attached once to the base canvas; overlay is pointer-events-none).
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 20])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        onScalesChange?.({ scaleX, scaleY, transform: event.transform });
        scheduleBaseRef.current();
        scheduleOverlayRef.current();
      });

    select(canvas).call(zoomBehavior);
    return () => {
      select(canvas).on(".zoom", null);
    };
  }, [scaleX, scaleY, onScalesChange]);

  // Mouse interaction (on the base canvas). Dedupe hover so we only update state when the
  // nearest point actually changes — otherwise every mousemove frame churns React state
  // and forces a full re-render (the source of the flicker).
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const pick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return findNearestPointLinear(
        points,
        e.clientX - rect.left,
        e.clientY - rect.top,
        15,
        scaleX,
        scaleY,
        transformRef.current
      );
    };

    const handleMouseMove = (e: MouseEvent) => {
      const idx = pick(e);
      if (idx !== lastHoverRef.current) {
        lastHoverRef.current = idx;
        onHoverPoint(idx);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const idx = pick(e);
      if (idx !== null) {
        const [, , , , caseIdx, sentIdx] = points[idx];
        onClickPoint(caseIdx, sentIdx);
      }
    };

    const handleMouseLeave = () => {
      if (lastHoverRef.current !== null) {
        lastHoverRef.current = null;
        onHoverPoint(null);
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [points, scaleX, scaleY, onHoverPoint, onClickPoint]);

  // Redraw base only when base inputs change; overlay only when hover changes.
  useEffect(() => {
    scheduleBase();
  }, [scheduleBase]);

  useEffect(() => {
    scheduleOverlay();
  }, [scheduleOverlay]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={baseCanvasRef} className="absolute inset-0 cursor-crosshair" />
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none"
      />
    </div>
  );
}
