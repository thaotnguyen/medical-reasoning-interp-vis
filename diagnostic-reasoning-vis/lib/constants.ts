import type { Pipeline } from "./types";

export const DEFAULT_MODEL = "qwq-32b";
export const DEFAULT_DATASET = "medqa";
export const DEFAULT_PIPELINE: Pipeline = "dedup";

export const PIPELINES: { id: Pipeline; label: string; short: string }[] = [
  { id: "dedup", label: "Latent embedding", short: "Latent embedding" },
];

export const PIPELINE_HAS_DATASET: Record<Pipeline, boolean> = {
  dedup: false,
  pipeline: false,
};

/**
 * Default 12-color palette covering taxonomies up to 12 states. Extends the
 * original 7-color sentence palette with 5 additional categorical colors.
 */
export const TAXONOMY_COLORS = [
  "#9467bd", // Orchestration
  "#ff7f0e", // Case Evidence Extraction
  "#1f77b4", // Evidence Processing
  "#e377c2", // Hypothesis Generation
  "#2ca02c", // Hypothesis Evaluation
  "#d62728", // Recalling Medical Knowledge
  "#8c564b", // Final Answer
  "#17becf", // extra 1 (cyan)
  "#bcbd22", // extra 2 (olive)
  "#7f7f7f", // extra 3 (gray)
  "#5b8def", // extra 4
  "#e7969c", // extra 5
];

export const NO_DATA_COLOR = "#94a3b8"; // slate-400 for missing taxonomy
