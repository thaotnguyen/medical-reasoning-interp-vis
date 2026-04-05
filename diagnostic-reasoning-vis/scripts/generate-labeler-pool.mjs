import fs from "node:fs";
import path from "node:path";

import {
  TRAINING_CASES,
  buildCaseCandidateFromTraces,
  selectCasesByCellTargets,
  shuffleSelectedCasesDeterministically,
  sortAndSelectTestCases,
} from "../lib/labeler-pool.ts";

const TEST_POOL_SIZE = 100;
const SHUFFLE_SEED = 20260404;
const CELL_TARGETS = [
  { model: "deepseek-r1-distill-llama-8b", dataset: "medqa", count: 40 },
  { model: "deepseek-r1-distill-qwen-14b", dataset: "medqa", count: 20 },
  { model: "deepseek-r1-distill-qwen-1.5b", dataset: "medmcqa-filtered", count: 20 },
  { model: "deepseek-r1-distill-qwen-14b", dataset: "medmcqa-filtered", count: 2 },
  { model: "gpt-oss-20b", dataset: "medmcqa-filtered", count: 4 },
  { model: "huatuogpt-o1-8b", dataset: "medmcqa-filtered", count: 3 },
  { model: "qwq-32b", dataset: "medmcqa-filtered", count: 1 },
  { model: "deepseek-r1-distill-qwen-14b", dataset: "nejm-cpc", count: 2 },
  { model: "gpt-oss-20b", dataset: "nejm-cpc", count: 4 },
  { model: "qwq-32b", dataset: "nejm-cpc", count: 4 },
];

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const whiteBoxRoot = path.join(workspaceRoot, "white_box_data");
const blackBoxRoot = path.join(workspaceRoot, "black_box_data");
const publicDataRoot = path.join(appRoot, "public", "data");
const casesRoot = path.join(publicDataRoot, "cases");
const metadataPath = path.join(publicDataRoot, "metadata.json");
const outputPath = path.join(publicDataRoot, "labeler-pool.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function caseKey(pmcid, questionId, prompt) {
  return JSON.stringify([pmcid ?? null, questionId ?? null, prompt ?? null]);
}

function traceKey(trace) {
  return caseKey(trace.pmcid, trace.question_id, trace.case_prompt);
}

function publicCaseKey(caseRecord) {
  return caseKey(caseRecord.id, caseRecord.qid, caseRecord.prompt);
}

const casesCache = new Map();

function loadCasesIndex(model, dataset) {
  const cacheKey = `${model}_${dataset}`;
  const cached = casesCache.get(cacheKey);
  if (cached) return cached;

  const filePath = path.join(casesRoot, `${cacheKey}.json`);
  const cases = readJson(filePath);
  const byExactKey = new Map();
  const byPmcid = new Map();

  cases.forEach((caseRecord, index) => {
    const exactKey = publicCaseKey(caseRecord);
    if (!byExactKey.has(exactKey)) {
      byExactKey.set(exactKey, index);
    }

    const pmcid = typeof caseRecord.id === "string" ? caseRecord.id : null;
    if (!pmcid) return;
    const existing = byPmcid.get(pmcid);
    if (existing === undefined) {
      byPmcid.set(pmcid, index);
    } else if (existing !== index) {
      byPmcid.set(pmcid, null);
    }
  });

  const result = { cases, byExactKey, byPmcid };
  casesCache.set(cacheKey, result);
  return result;
}

function getCaseIndex(model, dataset, trace) {
  const { byExactKey, byPmcid } = loadCasesIndex(model, dataset);
  const exactMatch = byExactKey.get(traceKey(trace));
  if (exactMatch !== undefined) return exactMatch;

  const pmcid = typeof trace.pmcid === "string" ? trace.pmcid : null;
  if (!pmcid) return null;
  const pmcidMatch = byPmcid.get(pmcid);
  return typeof pmcidMatch === "number" ? pmcidMatch : null;
}

function getTrainingPmcids() {
  return new Set(
    TRAINING_CASES.map((item) => {
      const { cases } = loadCasesIndex(item.model, item.dataset);
      const caseRecord = cases[item.caseIndex];
      if (!caseRecord?.id) {
        throw new Error(
          `Training case missing from public data: ${item.model} ${item.dataset} ${item.caseIndex}`
        );
      }
      return caseRecord.id;
    })
  );
}

function buildManifest() {
  const metadata = readJson(metadataPath);
  const trainingPmcids = getTrainingPmcids();
  const candidates = [];

  for (const model of metadata.model_order) {
    for (const dataset of metadata.dataset_order) {
      const datasetDir = `${dataset}_with_second_responses`;
      const whitePath = path.join(whiteBoxRoot, model, datasetDir, "results.labeled.json");
      const blackPath = path.join(blackBoxRoot, model, datasetDir, "results.labeled.json");
      if (!fs.existsSync(whitePath) || !fs.existsSync(blackPath)) continue;

      const whiteTraces = readJson(whitePath).traces ?? [];
      const blackTraces = readJson(blackPath).traces ?? [];
      const blackByKey = new Map(blackTraces.map((trace) => [traceKey(trace), trace]));

      for (const whiteTrace of whiteTraces) {
        const blackTrace = blackByKey.get(traceKey(whiteTrace));
        if (!blackTrace) continue;

        const candidate = buildCaseCandidateFromTraces({
          model,
          dataset,
          whiteTrace,
          blackTrace,
        });
        if (!candidate) continue;
        if (trainingPmcids.has(candidate.pmcid)) continue;

        const caseIndex = getCaseIndex(model, dataset, whiteTrace);
        if (caseIndex === null) continue;

        candidates.push({ ...candidate, caseIndex });
      }
    }
  }

  const selected = selectCasesByCellTargets(
    candidates,
    CELL_TARGETS,
    metadata.dataset_order
  );

  if (selected.length < TEST_POOL_SIZE) {
    throw new Error(
      `Only found ${selected.length} qualifying ranked cases; expected ${TEST_POOL_SIZE}.`
    );
  }

  const ranked = sortAndSelectTestCases(
    selected,
    selected.length,
    metadata.dataset_order
  );
  const shuffled = shuffleSelectedCasesDeterministically(ranked, SHUFFLE_SEED);

  return {
    training: TRAINING_CASES,
    test: shuffled.map((item) => ({
      model: item.model,
      dataset: item.dataset,
      caseIndex: item.caseIndex,
      pmcid: item.pmcid,
      sentenceCount: item.sentenceCount,
      agreementKappa: item.agreementKappa,
    })),
  };
}

const manifest = buildManifest();
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `Wrote ${manifest.training.length} training + ${manifest.test.length} ranked test cases to ${outputPath}`
);
