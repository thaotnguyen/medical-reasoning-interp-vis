// ============================================================
// Geometric-pipeline taxonomy category descriptions and examples
// for tutorial / help. The 5 B0–B4 buckets were derived geometrically
// from SAE-disentangled sentence activations and labeled by GPT-5.
// ============================================================

import type { Pipeline } from "./types";

export interface TaxonomyReference {
  index: number;
  shortDescription: string;
  longDescription: string;
  positiveExample: string;
  positiveExplanation: string;
  negativeExample: string;
  negativeExplanation: string;
}

const GEOMETRIC_REFERENCES: TaxonomyReference[] = [
  {
    index: 0, // B0 — Enumerating clinical findings
    shortDescription:
      "Reporting patient-specific facts pulled from the case vignette.",
    longDescription:
      "Sentences that restate or enumerate specific clinical findings from the case — demographics, symptoms, vitals, exam findings, lab/imaging results, history. The information comes directly from the case text rather than from general medical knowledge.",
    positiveExample:
      "The patient is a 23-year-old with a history of anxiety and treated schizophrenia.",
    positiveExplanation:
      "Restates case-specific facts the model is grounding its reasoning on.",
    negativeExample:
      "Hypocalcemia is a well-known cause of carpopedal spasm.",
    negativeExplanation:
      "General medical knowledge, not a fact lifted from the vignette.",
  },
  {
    index: 1, // B1 — Stating the final diagnosis
    shortDescription:
      "Committing to a final diagnosis or summary conclusion.",
    longDescription:
      "Sentences that consolidate the preceding analysis into a definitive diagnostic answer or summary judgement. They typically appear toward the end of a trace and signal the transition from deliberation to commitment.",
    positiveExample:
      "So the underlying issue is hypocalcemia, which can cause seizures.",
    positiveExplanation:
      "Names a single underlying diagnosis as the conclusion of the reasoning.",
    negativeExample:
      "It could be hypocalcemia, hypomagnesemia, or a medication side effect.",
    negativeExplanation:
      "Still listing possibilities (Generating differential diagnoses).",
  },
  {
    index: 2, // B2 — Generating differential diagnoses
    shortDescription:
      "Proposing or expanding candidate diagnoses to consider.",
    longDescription:
      "Sentences that introduce new diagnostic possibilities, list a differential, or pivot toward an alternative explanation. Hedged language (\"could be,\" \"maybe,\" \"points to\") and lists of conditions are typical markers.",
    positiveExample:
      "Which is often associated with low calcium levels (hypocalcemia) or maybe low magnesium.",
    positiveExplanation:
      "Introduces multiple candidate causes worth considering.",
    negativeExample:
      "The patient has a 1-month history of carpopedal spasm.",
    negativeExplanation:
      "Just restates a case finding (Enumerating clinical findings).",
  },
  {
    index: 3, // B3 — Stepwise analysis planning
    shortDescription:
      "Meta-statements that organize or steer the reasoning process.",
    longDescription:
      "Procedural sentences that frame the analysis — opening remarks, transitions, statements of intent (\"let me think step by step\"). They manage how the model is going to reason rather than make a claim about the patient.",
    positiveExample: "Okay, let's tackle this case.",
    positiveExplanation:
      "Pure meta-framing of the upcoming analysis; no medical claim.",
    negativeExample: "The seizure was managed with diazepam.",
    negativeExplanation:
      "Reports a case event (Enumerating clinical findings).",
  },
  {
    index: 4, // B4 — Classifying Clinical Measurements
    shortDescription:
      "Interpreting vitals, labs, or other measurements as normal/abnormal.",
    longDescription:
      "Sentences that judge whether a measurement is within range, elevated, depressed, or otherwise significant — translating raw numbers and observations into a clinical classification.",
    positiveExample:
      "But he has normal blood pressure and labs are normal.",
    positiveExplanation:
      "Classifies the measurements as normal, a value judgement on the data.",
    negativeExample:
      "His blood pressure is 152/86 in the right arm and 130/72 in the left.",
    negativeExplanation:
      "Just reports the raw number (Enumerating clinical findings).",
  },
];

export const TAXONOMY_REFERENCES_BY_PIPELINE: Record<
  Pipeline,
  TaxonomyReference[]
> = {
  geometric: GEOMETRIC_REFERENCES,
};

/** Back-compat shim: the geometric references. */
export const TAXONOMY_REFERENCES: TaxonomyReference[] = GEOMETRIC_REFERENCES;

export function getTaxonomyReferences(
  pipeline: Pipeline
): TaxonomyReference[] {
  return TAXONOMY_REFERENCES_BY_PIPELINE[pipeline] ?? GEOMETRIC_REFERENCES;
}
