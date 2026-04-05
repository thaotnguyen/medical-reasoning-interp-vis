import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const manifestPath = path.join(
  import.meta.dirname,
  "..",
  "public",
  "data",
  "labeler-pool.json"
);

test("labeler-pool manifest contains pinned training cases and 100 ranked unique test cases", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.ok(Array.isArray(manifest.training));
  assert.ok(Array.isArray(manifest.test));
  assert.equal(manifest.training.length, 3);
  assert.equal(manifest.test.length, 100);

  for (const item of manifest.training) {
    assert.equal(item.isTraining, true);
  }

  for (const item of manifest.test) {
    assert.equal(typeof item.model, "string");
    assert.equal(typeof item.dataset, "string");
    assert.equal(typeof item.caseIndex, "number");
    assert.equal(typeof item.pmcid, "string");
    assert.equal(typeof item.sentenceCount, "number");
    assert.equal(typeof item.agreementKappa, "number");
    assert.ok(Number.isFinite(item.agreementKappa));
    assert.ok(item.sentenceCount > 10);
  }

  assert.equal(
    new Set(manifest.test.map((item) => item.pmcid)).size,
    manifest.test.length
  );

  const datasetCounts = {};
  const modelCounts = {};
  for (const item of manifest.test) {
    datasetCounts[item.dataset] = (datasetCounts[item.dataset] ?? 0) + 1;
    modelCounts[item.model] = (modelCounts[item.model] ?? 0) + 1;
  }

  assert.deepEqual(datasetCounts, {
    medqa: 60,
    "medmcqa-filtered": 30,
    "nejm-cpc": 10,
  });

  assert.deepEqual(modelCounts, {
    "deepseek-r1-distill-llama-8b": 40,
    "deepseek-r1-distill-qwen-1.5b": 20,
    "deepseek-r1-distill-qwen-14b": 24,
    "gpt-oss-20b": 8,
    "huatuogpt-o1-8b": 3,
    "qwq-32b": 5,
  });

  const average = (items) =>
    items.reduce((sum, item) => sum + item.agreementKappa, 0) / items.length;
  assert.ok(
    average(manifest.test.slice(0, 20)) > average(manifest.test.slice(-20)),
    "Expected the visible order to bias higher-kappa cases toward the top"
  );

  let adjacentRepeats = 0;
  for (let i = 1; i < manifest.test.length; i++) {
    const prev = manifest.test[i - 1];
    const curr = manifest.test[i];
    if (prev.model === curr.model && prev.dataset === curr.dataset) {
      adjacentRepeats++;
    }
  }
  assert.equal(
    adjacentRepeats,
    0,
    "Expected the visible order to avoid adjacent cases from the same model-dataset cell"
  );

  assert.ok(
    new Set(manifest.test.slice(0, 12).map((item) => item.model)).size >= 3,
    "Expected the first 12 visible test cases to include multiple models"
  );
  assert.ok(
    new Set(manifest.test.slice(0, 12).map((item) => item.dataset)).size >= 2,
    "Expected the first 12 visible test cases to mix multiple datasets"
  );
});
