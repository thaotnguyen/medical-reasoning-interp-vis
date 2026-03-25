"use client";

import { create } from "zustand";
import { DEFAULT_MODEL, DEFAULT_DATASET } from "@/lib/constants";

interface AppState {
  selectedModel: string;
  selectedDataset: string;
  selectedCaseIndex: number;
  colorMode: "taxonomy" | "cluster";
  hoveredPointIndex: number | null;
  hoveredSentenceIndex: number | null;
  trajectoryProgress: number;
  trajectoryPlaying: boolean;

  setModel: (model: string) => void;
  setDataset: (dataset: string) => void;
  setCaseIndex: (index: number) => void;
  setColorMode: (mode: "taxonomy" | "cluster") => void;
  setHoveredPoint: (index: number | null) => void;
  setHoveredSentence: (index: number | null) => void;
  setTrajectoryProgress: (progress: number) => void;
  setTrajectoryPlaying: (playing: boolean) => void;
  navigateToCase: (caseIndex: number) => void;
}

export const useAppState = create<AppState>((set) => ({
  selectedModel: DEFAULT_MODEL,
  selectedDataset: DEFAULT_DATASET,
  selectedCaseIndex: 0,
  colorMode: "taxonomy",
  hoveredPointIndex: null,
  hoveredSentenceIndex: null,
  trajectoryProgress: 0,
  trajectoryPlaying: false,

  setModel: (model) =>
    set({ selectedModel: model, selectedCaseIndex: 0, hoveredPointIndex: null, hoveredSentenceIndex: null }),
  setDataset: (dataset) =>
    set({ selectedDataset: dataset, selectedCaseIndex: 0, hoveredPointIndex: null, hoveredSentenceIndex: null }),
  setCaseIndex: (index) =>
    set({ selectedCaseIndex: index, hoveredPointIndex: null, hoveredSentenceIndex: null }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setHoveredPoint: (index) => set({ hoveredPointIndex: index }),
  setHoveredSentence: (index) => set({ hoveredSentenceIndex: index }),
  setTrajectoryProgress: (progress) => set({ trajectoryProgress: progress }),
  setTrajectoryPlaying: (playing) => set({ trajectoryPlaying: playing }),
  navigateToCase: (caseIndex) =>
    set({ selectedCaseIndex: caseIndex, hoveredPointIndex: null, hoveredSentenceIndex: null, trajectoryProgress: 0, trajectoryPlaying: true }),
}));
