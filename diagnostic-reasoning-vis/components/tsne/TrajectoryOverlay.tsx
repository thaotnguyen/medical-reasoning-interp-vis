"use client";

import { useMemo, useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "motion/react";
import type { Sentence } from "@/lib/types";
import type { ScaleLinear } from "d3-scale";
import type { ZoomTransform } from "d3-zoom";

interface TrajectoryOverlayProps {
  sentences: Sentence[];
  scaleX: ScaleLinear<number, number>;
  scaleY: ScaleLinear<number, number>;
  transform: ZoomTransform;
  hoveredSentenceIndex: number | null;
  isPlaying: boolean;
  onPlayComplete: () => void;
}

export function TrajectoryOverlay({
  sentences,
  scaleX,
  scaleY,
  transform,
  hoveredSentenceIndex,
  isPlaying,
  onPlayComplete,
}: TrajectoryOverlayProps) {
  const pathLength = useMotionValue(0);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);

  // Get sentences with valid t-SNE coords
  const validSentences = useMemo(
    () => sentences.filter((s) => s.x !== null && s.y !== null),
    [sentences]
  );

  // Compute screen-space points for the valid sentences
  const screenPoints = useMemo(() => {
    return validSentences.map((s) => ({
      px: transform.applyX(scaleX(s.x!)),
      py: transform.applyY(scaleY(s.y!)),
    }));
  }, [validSentences, scaleX, scaleY, transform]);

  // Compute path string
  const pathD = useMemo(() => {
    if (screenPoints.length < 2) return "";
    return screenPoints
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.px} ${pt.py}`)
      .join(" ");
  }, [screenPoints]);

  // Compute cumulative geometric distances along the path, normalized to [0,1]
  const cumulativeFractions = useMemo(() => {
    if (screenPoints.length < 2) return [];
    const distances = [0];
    for (let i = 1; i < screenPoints.length; i++) {
      const dx = screenPoints[i].px - screenPoints[i - 1].px;
      const dy = screenPoints[i].py - screenPoints[i - 1].py;
      distances.push(distances[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    const totalLength = distances[distances.length - 1];
    if (totalLength === 0) return screenPoints.map(() => 0);
    return distances.map((d) => d / totalLength);
  }, [screenPoints]);

  // Compute geometric fraction for hovered sentence
  const hoveredFraction = useMemo(() => {
    if (hoveredSentenceIndex === null || validSentences.length === 0) return null;
    const hoveredSent = sentences[hoveredSentenceIndex];
    if (!hoveredSent || hoveredSent.x === null) return null;
    const validIdx = validSentences.indexOf(hoveredSent);
    if (validIdx < 0 || validIdx >= cumulativeFractions.length) return null;
    return cumulativeFractions[validIdx];
  }, [hoveredSentenceIndex, sentences, validSentences, cumulativeFractions]);

  // Dot position from hovered sentence
  const dotPos = useMemo(() => {
    if (hoveredSentenceIndex === null || validSentences.length === 0) return null;
    const hoveredSent = sentences[hoveredSentenceIndex];
    if (!hoveredSent || hoveredSent.x === null) return null;
    const validIdx = validSentences.indexOf(hoveredSent);
    if (validIdx < 0 || validIdx >= screenPoints.length) return null;
    return { cx: screenPoints[validIdx].px, cy: screenPoints[validIdx].py };
  }, [hoveredSentenceIndex, sentences, validSentences, screenPoints]);

  // Animate on play
  useEffect(() => {
    if (isPlaying && validSentences.length >= 2) {
      pathLength.set(0);
      animRef.current = animate(pathLength, 1, {
        duration: 2,
        ease: "easeInOut",
        onComplete: onPlayComplete,
      });
    }
    return () => {
      animRef.current?.stop();
    };
  }, [isPlaying, validSentences.length, pathLength, onPlayComplete]);

  // Snap path to hovered sentence using geometric fraction
  useEffect(() => {
    if (hoveredFraction !== null) {
      animRef.current?.stop();
      pathLength.set(hoveredFraction);
    }
  }, [hoveredFraction, pathLength]);

  if (validSentences.length < 2 || !pathD) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
      {/* Full path (faint) */}
      <path
        d={pathD}
        fill="none"
        stroke="#000"
        strokeWidth={1}
        opacity={0.1}
      />
      {/* Animated path */}
      <motion.path
        d={pathD}
        fill="none"
        stroke="#000"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          pathLength,
          opacity: 0.6,
        }}
      />
      {/* Dot at hovered position */}
      {dotPos && (
        <circle
          cx={dotPos.cx}
          cy={dotPos.cy}
          r={5}
          fill="#000"
          opacity={0.8}
          stroke="#fff"
          strokeWidth={1.5}
        />
      )}
    </svg>
  );
}
