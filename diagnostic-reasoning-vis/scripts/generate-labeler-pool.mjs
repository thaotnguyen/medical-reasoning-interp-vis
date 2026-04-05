import fs from "node:fs";
import path from "node:path";

import {
  TRAINING_CASES,
  buildCaseCandidateFromTraces,
  selectCasesWithCoverage,
  shuffleSelectedCasesDeterministically,
  sortPoolEntriesByAgreement,
} from "../lib/labeler-pool.ts";

const TEST_POOL_SIZE = 100;
const ORDER_SEED = 20260405;
const FALLBACK_SEED = 20260405;
const KEVIN_FIXED_CASES = [
  {
    model: "deepseek-r1-distill-qwen-14b",
    dataset: "medmcqa-filtered",
    caseIndex: 79,
    pmcid: "650e00e273df4f2b947cf25779cd1f83",
  },
  {
    model: "deepseek-r1-distill-qwen-1.5b",
    dataset: "medmcqa-filtered",
    caseIndex: 563,
    pmcid: "edfb730a1ed7cb41432f607c2134cfb9",
  },
  {
    model: "deepseek-r1-distill-llama-8b",
    dataset: "medqa",
    caseIndex: 150,
    pmcid: "ec82fabb228f5b057ecb257a67cdefd2",
  },
  {
    model: "gpt-oss-20b",
    dataset: "medmcqa-filtered",
    caseIndex: 857,
    pmcid: "5e04571b261b905a9c392cfc1d1e189a",
  },
  {
    model: "deepseek-r1-distill-qwen-14b",
    dataset: "nejm-cpc",
    caseIndex: 30,
    pmcid: "f0e63b7ab7df33642365023abf1fc824",
  },
  {
    model: "deepseek-r1-distill-qwen-14b",
    dataset: "medqa",
    caseIndex: 425,
    pmcid: "1a52d111ac0e384ba9320b380d620263",
  },
  {
    model: "gpt-oss-20b",
    dataset: "medmcqa-filtered",
    caseIndex: 422,
    pmcid: "d4baf72f24008ddb038fa75c3afb1a05",
  },
  {
    model: "huatuogpt-o1-8b",
    dataset: "medmcqa-filtered",
    caseIndex: 444,
    pmcid: "f91a7e9f404b2c52f57b2b68390f0cd4",
  },
  {
    model: "qwq-32b",
    dataset: "nejm-cpc",
    caseIndex: 294,
    pmcid: "2ab3d10d8ea8d04a6cc0ea22a424b471",
  },
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

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleDeterministically(items, seed) {
  const rng = mulberry32(seed);
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

function getCaseRecord(model, dataset, caseIndex) {
  const { cases } = loadCasesIndex(model, dataset);
  return cases[caseIndex] ?? null;
}

function fixedCaseKey(item) {
  return `${item.model}__${item.dataset}__${item.caseIndex}__${item.pmcid}`;
}

function buildFixedCases(scoredCandidates) {
  const scoredByKey = new Map(
    scoredCandidates.map((candidate) => [fixedCaseKey(candidate), candidate])
  );

  return KEVIN_FIXED_CASES.map((fixedCase) => {
    const caseRecord = getCaseRecord(
      fixedCase.model,
      fixedCase.dataset,
      fixedCase.caseIndex
    );

    if (!caseRecord) {
      throw new Error(
        `Fixed case missing from public data: ${fixedCase.model} ${fixedCase.dataset} ${fixedCase.caseIndex}`
      );
    }

    if (caseRecord.id !== fixedCase.pmcid) {
      throw new Error(
        `Fixed case pmcid mismatch for ${fixedCase.model} ${fixedCase.dataset} ${fixedCase.caseIndex}: expected ${fixedCase.pmcid}, got ${caseRecord.id}`
      );
    }

    return {
      ...fixedCase,
      sentenceCount: caseRecord.sentences.length,
      agreementKappa: scoredByKey.get(fixedCaseKey(fixedCase))?.agreementKappa ?? null,
    };
  });
}

function buildFallbackCandidates(metadata, trainingPmcids) {
  const fallbackCandidates = [];

  for (const model of metadata.model_order) {
    for (const dataset of metadata.dataset_order) {
      const { cases } = loadCasesIndex(model, dataset);
      const shuffled = shuffleDeterministically(
        cases.map((caseRecord, caseIndex) => ({ caseRecord, caseIndex })),
        FALLBACK_SEED + hashString(`${model}__${dataset}`)
      );

      for (const { caseRecord, caseIndex } of shuffled) {
        if (typeof caseRecord.id !== "string" || caseRecord.id.length === 0) continue;
        if (trainingPmcids.has(caseRecord.id)) continue;
        if (!Array.isArray(caseRecord.sentences) || caseRecord.sentences.length <= 10) continue;

        fallbackCandidates.push({
          model,
          dataset,
          caseIndex,
          pmcid: caseRecord.id,
          sentenceCount: caseRecord.sentences.length,
          agreementKappa: null,
        });
      }
    }
  }

  return fallbackCandidates;
}

function incrementObjectCount(counts, key) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function distributeBalancedTargets(keys, total, baseCounts, scoredCounts) {
  const targets = Object.fromEntries(keys.map((key) => [key, baseCounts[key] ?? 0]));
  const baseTotal = Object.values(targets).reduce((sum, count) => sum + count, 0);
  const remaining = total - baseTotal;

  if (remaining < 0) {
    throw new Error(`Base counts exceed requested total: ${baseTotal} > ${total}`);
  }
  if (remaining === 0) return targets;

  const positiveKeys = keys.filter((key) => (scoredCounts[key] ?? 0) > 0);
  const weightedKeys = positiveKeys.length > 0 ? positiveKeys : keys;
  const weights = new Map(
    weightedKeys.map((key) => [
      key,
      positiveKeys.length > 0 ? Math.log((scoredCounts[key] ?? 0) + 1) : 1,
    ])
  );
  const totalWeight = [...weights.values()].reduce((sum, weight) => sum + weight, 0);

  const rawAllocations = weightedKeys.map((key) => {
    const raw = totalWeight > 0 ? (remaining * (weights.get(key) ?? 0)) / totalWeight : 0;
    const whole = Math.floor(raw);
    targets[key] += whole;
    return {
      key,
      remainder: raw - whole,
    };
  });

  let assigned = weightedKeys.reduce((sum, key) => sum + (targets[key] - (baseCounts[key] ?? 0)), 0);
  rawAllocations
    .sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key))
    .slice(0, remaining - assigned)
    .forEach(({ key }) => {
      targets[key] += 1;
      assigned++;
    });

  return targets;
}

function buildBalancedTargets(metadata, fixedCases, requiredCells, scoredCandidates) {
  const coveredCells = new Set(fixedCases.map((item) => `${item.model}__${item.dataset}`));
  const baseModelCounts = Object.fromEntries(metadata.model_order.map((model) => [model, 0]));
  const baseDatasetCounts = Object.fromEntries(
    metadata.dataset_order.map((dataset) => [dataset, 0])
  );
  const scoredModelCounts = Object.fromEntries(metadata.model_order.map((model) => [model, 0]));
  const scoredDatasetCounts = Object.fromEntries(
    metadata.dataset_order.map((dataset) => [dataset, 0])
  );

  for (const item of fixedCases) {
    incrementObjectCount(baseModelCounts, item.model);
    incrementObjectCount(baseDatasetCounts, item.dataset);
  }

  for (const cell of requiredCells) {
    const key = `${cell.model}__${cell.dataset}`;
    if (coveredCells.has(key)) continue;
    incrementObjectCount(baseModelCounts, cell.model);
    incrementObjectCount(baseDatasetCounts, cell.dataset);
  }

  for (const candidate of scoredCandidates) {
    incrementObjectCount(scoredModelCounts, candidate.model);
    incrementObjectCount(scoredDatasetCounts, candidate.dataset);
  }

  return {
    modelTargets: distributeBalancedTargets(
      metadata.model_order,
      TEST_POOL_SIZE,
      baseModelCounts,
      scoredModelCounts
    ),
    datasetTargets: distributeBalancedTargets(
      metadata.dataset_order,
      TEST_POOL_SIZE,
      baseDatasetCounts,
      scoredDatasetCounts
    ),
  };
}

function buildManifest() {
  const metadata = readJson(metadataPath);
  const trainingPmcids = getTrainingPmcids();
  const scoredCandidates = [];

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

        scoredCandidates.push({ ...candidate, caseIndex });
      }
    }
  }

  const fixedCases = buildFixedCases(scoredCandidates);
  const fallbackCandidates = buildFallbackCandidates(metadata, trainingPmcids);
  const requiredCells = metadata.model_order.flatMap((model) =>
    metadata.dataset_order.map((dataset) => ({ model, dataset }))
  );
  const { modelTargets, datasetTargets } = buildBalancedTargets(
    metadata,
    fixedCases,
    requiredCells,
    scoredCandidates
  );
  const selected = selectCasesWithCoverage({
    fixedCases,
    scoredCandidates,
    fallbackCandidates,
    requiredCells,
    maxCases: TEST_POOL_SIZE,
    datasetOrder: metadata.dataset_order,
    modelTargets,
    datasetTargets,
  });

  if (selected.length < TEST_POOL_SIZE) {
    throw new Error(
      `Only found ${selected.length} qualifying ranked cases; expected ${TEST_POOL_SIZE}.`
    );
  }

  const ranked = sortPoolEntriesByAgreement(selected, metadata.dataset_order);
  const shuffled = shuffleSelectedCasesDeterministically(ranked, ORDER_SEED);

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
