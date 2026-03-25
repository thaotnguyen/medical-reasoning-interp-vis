// ============================================================
// Taxonomy category descriptions and examples for tutorial/help
// ============================================================

export interface TaxonomyReference {
  index: number;
  shortDescription: string;
  longDescription: string;
  positiveExample: string;
  positiveExplanation: string;
  negativeExample: string;
  negativeExplanation: string;
}

export const TAXONOMY_REFERENCES: TaxonomyReference[] = [
  {
    index: 0,
    shortDescription:
      "Procedural statements that structure or control the reasoning process.",
    longDescription:
      "These are sentences where the model organizes its thinking, transitions between sections, or makes meta-comments about its reasoning strategy. They don't directly engage with medical content but instead manage the flow of the analysis.",
    positiveExample:
      "Let me work through this systematically, starting with the key symptoms.",
    positiveExplanation:
      "This is a meta-statement about how to approach the problem, not actual medical reasoning.",
    negativeExample:
      "The patient presents with fever and cough.",
    negativeExplanation:
      "This extracts case facts (Case Evidence Extraction), not reasoning structure.",
  },
  {
    index: 1,
    shortDescription:
      "Directly pulling facts from the patient case.",
    longDescription:
      "Sentences that identify, extract, or restate specific clinical details from the case vignette \u2014 demographics, symptoms, lab values, imaging findings, history. The key marker is that the information comes directly from the case text, not from medical knowledge.",
    positiveExample:
      "The patient is a 45-year-old male presenting with acute chest pain and shortness of breath.",
    positiveExplanation:
      "Directly restates facts given in the case vignette without interpretation.",
    negativeExample:
      "Chest pain with shortness of breath suggests a cardiopulmonary etiology.",
    negativeExplanation:
      "This interprets the findings (Evidence Processing), not just extracts them.",
  },
  {
    index: 2,
    shortDescription:
      "Interpreting, weighing, or synthesizing extracted findings.",
    longDescription:
      "Sentences that go beyond restating case facts to analyze their clinical significance, combine multiple findings, note patterns, or assess relevance. This is the interpretive bridge between raw evidence and hypothesis generation.",
    positiveExample:
      "The combination of sudden onset chest pain with elevated D-dimer is highly suggestive of a thromboembolic event.",
    positiveExplanation:
      "Synthesizes multiple case findings and draws a clinical inference from them.",
    negativeExample:
      "Pulmonary embolism typically presents with pleuritic chest pain and dyspnea.",
    negativeExplanation:
      "This states general medical knowledge (Medical Knowledge Recall), not patient-specific interpretation.",
  },
  {
    index: 3,
    shortDescription:
      "Recalling general medical facts, criteria, or disease features.",
    longDescription:
      "Sentences where the model draws on medical knowledge not present in the case \u2014 disease definitions, diagnostic criteria, pathophysiology, epidemiology, treatment guidelines. The information would be true regardless of this specific patient.",
    positiveExample:
      "Pulmonary embolism is diagnosed using the Wells criteria and confirmed with CT pulmonary angiography.",
    positiveExplanation:
      "States a general medical fact about PE diagnosis, independent of the patient case.",
    negativeExample:
      "This patient's Wells score would be high given the tachycardia and recent surgery.",
    negativeExplanation:
      "This applies criteria to the specific patient (Evidence Processing), not just recalls them.",
  },
  {
    index: 4,
    shortDescription:
      "Proposing possible diagnoses or differential items.",
    longDescription:
      "Sentences that introduce new diagnostic possibilities, expand the differential, or suggest potential diagnoses. The key marker is the introduction of a diagnosis that hasn\u2019t been previously mentioned in the reasoning trace.",
    positiveExample:
      "This could represent pulmonary embolism, pneumothorax, or acute coronary syndrome.",
    positiveExplanation:
      "Introduces multiple new diagnostic possibilities for the first time.",
    negativeExample:
      "Pulmonary embolism fits well with the elevated D-dimer finding.",
    negativeExplanation:
      "This evaluates an already-proposed hypothesis (Hypothesis Evaluation), not generates a new one.",
  },
  {
    index: 5,
    shortDescription:
      "Supporting, weighing, or eliminating diagnostic possibilities.",
    longDescription:
      "Sentences that assess how well evidence supports or refutes a previously proposed diagnosis. This includes comparing hypotheses, ruling diagnoses in or out, and explaining why certain diagnoses are more or less likely.",
    positiveExample:
      "Pneumothorax is less likely given the absence of decreased breath sounds on the affected side.",
    positiveExplanation:
      "Evaluates and weakens an existing hypothesis based on evidence.",
    negativeExample:
      "We should also consider aortic dissection.",
    negativeExplanation:
      "This introduces a new hypothesis (Hypothesis Generation), not evaluates an existing one.",
  },
  {
    index: 6,
    shortDescription:
      "Committing to the final diagnosis or answer.",
    longDescription:
      "Sentences where the model makes its definitive diagnostic conclusion or selects its final answer. These typically appear near the end of the reasoning trace and represent the transition from deliberation to decision.",
    positiveExample:
      "Based on the clinical picture, the most likely diagnosis is pulmonary embolism. The answer is B.",
    positiveExplanation:
      "Makes a definitive commitment to a final answer.",
    negativeExample:
      "Pulmonary embolism remains the leading diagnosis at this point.",
    negativeExplanation:
      "Still deliberating and hedging (Hypothesis Evaluation), not yet committing to a final answer.",
  },
];
