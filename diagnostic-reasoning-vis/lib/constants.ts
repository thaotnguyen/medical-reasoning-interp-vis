import type { Pipeline } from "./types";

export const DEFAULT_MODEL = "qwq-32b";
export const DEFAULT_DATASET = "medqa";
export const DEFAULT_PIPELINE: Pipeline = "gwot";

export const PIPELINES: { id: Pipeline; label: string; short: string }[] = [
  { id: "gwot", label: "GWOT, 6 groups", short: "GWOT, 6 groups" },
];

/**
 * The taxonomy the labeler and agreement pages rate against: its categories are the labels
 * raters choose from, and its labeler-pool.json and cases are what they rate.
 */
export const LABELER_PIPELINE: Pipeline = "gwot";

/**
 * The labeling round in force until someone resets. Ratings are stored per round under
 * ratings/<round>/; "Reset for everyone" on the agreement page starts a new round, and earlier
 * rounds stay in blob storage but are never read.
 */
export const FIRST_RATINGS_ROUND = "2026-10-18";

export const PIPELINE_HAS_DATASET: Record<Pipeline, boolean> = {
  dedup: false,
  pipeline: false,
  tenmodel: false,
  gwot: false,
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
