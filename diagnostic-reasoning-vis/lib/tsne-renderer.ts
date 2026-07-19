import type { TSNEPoint } from "./types";
import type { ScaleLinear } from "d3-scale";
import type { ZoomTransform } from "d3-zoom";

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  points: TSNEPoint[];
  scaleX: ScaleLinear<number, number>;
  scaleY: ScaleLinear<number, number>;
  colorMode: "taxonomy" | "cluster";
  taxonomyColors: string[];
  clusterColorMap: Map<number, string>;
  activeCaseIdx: number | null;
  hoveredIdx: number | null;
  transform: ZoomTransform;
  dpr: number;
}

function colorFor(
  tax: number,
  cluster: number,
  colorMode: "taxonomy" | "cluster",
  taxonomyColors: string[],
  clusterColorMap: Map<number, string>
): string {
  return colorMode === "taxonomy"
    ? taxonomyColors[tax] ?? "#94a3b8"
    : clusterColorMap.get(cluster) ?? "#94a3b8";
}

function applyTransform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  transform: ZoomTransform
) {
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);
}

/**
 * Base layer: every point drawn once, uniformly faint (alpha 0.1), independent of hover and of
 * the active case. This is the expensive ~O(N) pass, so it redraws only when the
 * data / scales / colors / zoom change — never on hover or case navigation.
 */
export function renderBase(opts: Omit<RenderOptions, "hoveredIdx" | "activeCaseIdx">) {
  const { ctx, width, height, points, scaleX, scaleY, colorMode,
    taxonomyColors, clusterColorMap, transform, dpr } = opts;

  applyTransform(ctx, width, height, dpr, transform);
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < points.length; i++) {
    const [x, y, tax, cluster] = points[i];
    ctx.beginPath();
    ctx.arc(scaleX(x), scaleY(y), 3, 0, Math.PI * 2);
    ctx.fillStyle = colorFor(tax, cluster, colorMode, taxonomyColors, clusterColorMap);
    ctx.fill();
  }
  ctx.restore();
}

export interface OverlayOptions extends Omit<RenderOptions, "activeCaseIdx"> {
  /** Row indices of the current case's sentences (precomputed so hover stays O(caseSize)). */
  activeCaseIndices: number[];
}

/**
 * Overlay layer: the current case's sentences drawn solid, plus the single hovered/current
 * sentence emphasised on top. Only these (~case-size + 1) marks are drawn, so it repaints cheaply
 * on hover or case change without touching the 70k base.
 */
export function renderOverlay(opts: OverlayOptions) {
  const { ctx, width, height, points, scaleX, scaleY, colorMode,
    taxonomyColors, clusterColorMap, activeCaseIndices, hoveredIdx, transform, dpr } = opts;

  applyTransform(ctx, width, height, dpr, transform);

  // current case: solid, slightly larger, thin dark ring
  for (const i of activeCaseIndices) {
    if (i === hoveredIdx) continue;
    const [x, y, tax, cluster] = points[i];
    ctx.beginPath();
    ctx.arc(scaleX(x), scaleY(y), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = colorFor(tax, cluster, colorMode, taxonomyColors, clusterColorMap);
    ctx.globalAlpha = 1.0;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
  }

  // hovered / current sentence: largest, full ring
  if (hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length) {
    const [x, y, tax, cluster] = points[hoveredIdx];
    ctx.beginPath();
    ctx.arc(scaleX(x), scaleY(y), 7, 0, Math.PI * 2);
    ctx.fillStyle = colorFor(tax, cluster, colorMode, taxonomyColors, clusterColorMap);
    ctx.globalAlpha = 1.0;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

/** Single-pass renderer (kept for non-interactive/export callers). */
export function renderTSNE(opts: RenderOptions) {
  renderBase(opts);
  const { activeCaseIdx, ...rest } = opts;
  const activeCaseIndices: number[] = [];
  if (activeCaseIdx !== null) {
    for (let i = 0; i < opts.points.length; i++) {
      if (opts.points[i][4] === activeCaseIdx) activeCaseIndices.push(i);
    }
  }
  renderOverlay({ ...rest, activeCaseIndices });
}
