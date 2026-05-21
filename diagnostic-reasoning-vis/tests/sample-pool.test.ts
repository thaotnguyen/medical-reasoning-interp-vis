import test from "node:test";
import assert from "node:assert/strict";

import * as samplePool from "../lib/sample-pool";

const modelOrder = [
  "claude-3-7-sonnet-20250219",
  "deepseek-r1-distill-llama-8b",
  "deepseek-r1-distill-qwen-1.5b",
  "deepseek-r1-distill-qwen-14b",
  "gpt-oss-20b",
  "grok-3-mini",
  "huatuogpt-o1-8b",
  "qwq-32b",
];

const datasetOrder = ["medqa", "medmcqa-filtered", "nejm-cpc"];

const caseCounts = Object.fromEntries(
  modelOrder.map((model) => [
    model,
    Object.fromEntries(datasetOrder.map((dataset) => [dataset, 300])),
  ])
) as Record<string, Record<string, number>>;

test("buildSamplePool returns one deterministic test case per model/dataset stratum", () => {
  const pool = samplePool.buildSamplePool(modelOrder, datasetOrder, caseCounts);

  assert.equal(pool.length, 24);
  assert.deepEqual(
    pool.map((item) => item.index),
    Array.from({ length: 24 }, (_, index) => index)
  );
  assert.equal(
    new Set(pool.map((item) => `${item.model}_${item.dataset}`)).size,
    24
  );

  const overriddenCase = pool.find(
    (item) =>
      item.model === "deepseek-r1-distill-qwen-14b" &&
      item.dataset === "nejm-cpc"
  );

  assert.ok(overriddenCase);
  assert.equal(overriddenCase.caseIndex, 250);
});

test("buildFullPool prepends the 3 training cases before the 24 test cases", () => {
  const moduleWithFullPool = samplePool as typeof samplePool & {
    buildFullPool?: (
      modelOrder: string[],
      datasetOrder: string[],
      caseCounts: Record<string, Record<string, number>>
    ) => Array<{
      index: number;
      model: string;
      dataset: string;
      caseIndex: number;
      isTraining?: boolean;
    }>;
    TRAINING_CASES?: Array<{
      model: string;
      dataset: string;
      caseIndex: number;
      isTraining?: boolean;
    }>;
  };

  assert.equal(typeof moduleWithFullPool.buildFullPool, "function");
  assert.ok(Array.isArray(moduleWithFullPool.TRAINING_CASES));

  const fullPool = moduleWithFullPool.buildFullPool!(
    modelOrder,
    datasetOrder,
    caseCounts
  );

  assert.equal(fullPool.length, 27);
  assert.deepEqual(
    fullPool.map((item) => item.index),
    Array.from({ length: 27 }, (_, index) => index)
  );
  assert.deepEqual(
    fullPool.slice(0, 3).map((item) => ({
      model: item.model,
      dataset: item.dataset,
      caseIndex: item.caseIndex,
      isTraining: item.isTraining,
    })),
    [
      {
        model: "claude-3-7-sonnet-20250219",
        dataset: "medqa",
        caseIndex: 0,
        isTraining: true,
      },
      {
        model: "qwq-32b",
        dataset: "medmcqa-filtered",
        caseIndex: 0,
        isTraining: true,
      },
      {
        model: "gpt-oss-20b",
        dataset: "nejm-cpc",
        caseIndex: 0,
        isTraining: true,
      },
    ]
  );
  assert.ok(fullPool.slice(3).every((item) => !item.isTraining));
});
