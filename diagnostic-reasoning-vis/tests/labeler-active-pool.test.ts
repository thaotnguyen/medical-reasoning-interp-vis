import test from "node:test";
import assert from "node:assert/strict";

async function loadPoolBuilder() {
  return import(new URL("../lib/labeler-active-pool.ts", import.meta.url).href);
}

test("buildActiveLabelerPool returns 3 training cases plus 100 deterministic random test cases", async () => {
  const { buildActiveLabelerPool } = await loadPoolBuilder();
  const metadataModule = await import(
    new URL("../public/data/metadata.json", import.meta.url).href,
    { with: { type: "json" } }
  );
  const metadata = metadataModule.default;

  const pool = buildActiveLabelerPool(metadata);
  const testPool = pool.filter(
    (item: { isTraining?: boolean }) => !item.isTraining
  );

  assert.equal(pool.length, 103);
  assert.deepEqual(
    pool.slice(0, 10).map((item: { model: string; dataset: string; caseIndex: number; index: number; isTraining?: boolean }) => ({
      model: item.model,
      dataset: item.dataset,
      caseIndex: item.caseIndex,
      index: item.index,
      isTraining: item.isTraining,
    })),
    [
      {
        model: "claude-3-7-sonnet-20250219",
        dataset: "medqa",
        caseIndex: 0,
        index: 0,
        isTraining: true,
      },
      {
        model: "qwq-32b",
        dataset: "medmcqa-filtered",
        caseIndex: 0,
        index: 1,
        isTraining: true,
      },
      {
        model: "gpt-oss-20b",
        dataset: "nejm-cpc",
        caseIndex: 0,
        index: 2,
        isTraining: true,
      },
      {
        model: "claude-3-7-sonnet-20250219",
        dataset: "medmcqa-filtered",
        caseIndex: 810,
        index: 3,
        isTraining: undefined,
      },
      {
        model: "deepseek-r1-distill-qwen-14b",
        dataset: "medmcqa-filtered",
        caseIndex: 638,
        index: 4,
        isTraining: undefined,
      },
      {
        model: "deepseek-r1-distill-qwen-1.5b",
        dataset: "nejm-cpc",
        caseIndex: 135,
        index: 5,
        isTraining: undefined,
      },
      {
        model: "grok-3-mini",
        dataset: "medmcqa-filtered",
        caseIndex: 1158,
        index: 6,
        isTraining: undefined,
      },
      {
        model: "gpt-oss-20b",
        dataset: "medmcqa-filtered",
        caseIndex: 732,
        index: 7,
        isTraining: undefined,
      },
      {
        model: "qwq-32b",
        dataset: "medmcqa-filtered",
        caseIndex: 520,
        index: 8,
        isTraining: undefined,
      },
      {
        model: "qwq-32b",
        dataset: "nejm-cpc",
        caseIndex: 123,
        index: 9,
        isTraining: undefined,
      },
    ]
  );

  assert.equal(testPool.length, 100);
  assert.equal(
    new Set(
      testPool.map(
        (item: { model: string; dataset: string; caseIndex: number }) =>
          `${item.model}_${item.dataset}_${item.caseIndex}`
      )
    ).size,
    100
  );

  const pairCounts = new Map<string, number>();
  for (const item of testPool) {
    const key = `${item.model}_${item.dataset}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  for (const model of metadata.model_order) {
    for (const dataset of metadata.dataset_order) {
      assert.ok(
        (pairCounts.get(`${model}_${dataset}`) ?? 0) >= 1,
        `missing test case for ${model}_${dataset}`
      );
    }
  }
});
