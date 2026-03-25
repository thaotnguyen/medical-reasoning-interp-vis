import { quadtree, type Quadtree } from "d3-quadtree";
import type { TSNEPoint } from "./types";
import type { ScaleLinear } from "d3-scale";
import type { ZoomTransform } from "d3-zoom";

export interface PointAccessor {
  x: (p: TSNEPoint) => number;
  y: (p: TSNEPoint) => number;
}

export function buildQuadtree(
  points: TSNEPoint[],
  scaleX: ScaleLinear<number, number>,
  scaleY: ScaleLinear<number, number>
): Quadtree<TSNEPoint> {
  return quadtree<TSNEPoint>()
    .x((d) => scaleX(d[0]))
    .y((d) => scaleY(d[1]))
    .addAll(points);
}

export function findNearestPoint(
  tree: Quadtree<TSNEPoint>,
  mx: number,
  my: number,
  maxRadius: number,
  transform: ZoomTransform
): { point: TSNEPoint; index: number } | null {
  // Convert mouse coordinates to data space
  const dataX = (mx - transform.x) / transform.k;
  const dataY = (my - transform.y) / transform.k;
  const searchRadius = maxRadius / transform.k;

  let best: TSNEPoint | undefined;
  let bestDist = searchRadius * searchRadius;

  tree.visit((node, x0, y0, x1, y1) => {
    if (!("data" in node)) {
      // Internal node: check if the bounding box is within search radius
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const halfW = (x1 - x0) / 2;
      const halfH = (y1 - y0) / 2;
      const dx = Math.max(0, Math.abs(dataX - cx) - halfW);
      const dy = Math.max(0, Math.abs(dataY - cy) - halfH);
      return dx * dx + dy * dy > bestDist;
    }

    // Leaf node: check distance
    let leaf: typeof node | undefined = node;
    while (leaf) {
      if (leaf.data) {
        const d = leaf.data;
        const dx = dataX - tree.x()(d);
        const dy = dataY - tree.y()(d);
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = d;
        }
      }
      leaf = leaf.next;
    }

    return false;
  });

  if (!best) return null;

  // Find the index in the original points array by reference
  // We rely on the points array being the same objects added to the tree
  const points = (tree as unknown as { _data?: TSNEPoint[] })._data;
  if (points) {
    const idx = points.indexOf(best);
    if (idx >= 0) return { point: best, index: idx };
  }

  return null;
}

/** Simpler nearest-point search that iterates through points directly */
export function findNearestPointLinear(
  points: TSNEPoint[],
  mx: number,
  my: number,
  maxRadius: number,
  scaleX: ScaleLinear<number, number>,
  scaleY: ScaleLinear<number, number>,
  transform: ZoomTransform
): number | null {
  const dataX = (mx - transform.x) / transform.k;
  const dataY = (my - transform.y) / transform.k;
  const r2 = (maxRadius / transform.k) ** 2;

  let bestIdx = -1;
  let bestDist = r2;

  for (let i = 0; i < points.length; i++) {
    const px = scaleX(points[i][0]);
    const py = scaleY(points[i][1]);
    const dx = dataX - px;
    const dy = dataY - py;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx >= 0 ? bestIdx : null;
}
