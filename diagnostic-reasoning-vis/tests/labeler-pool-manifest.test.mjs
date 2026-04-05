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
const metadataPath = path.join(
  import.meta.dirname,
  "..",
  "public",
  "data",
  "metadata.json"
);

test("labeler-pool manifest contains pinned training cases and 100 ranked unique test cases", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

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
    assert.ok(item.agreementKappa === null || typeof item.agreementKappa === "number");
    if (item.agreementKappa !== null) {
      assert.ok(Number.isFinite(item.agreementKappa));
    }
    assert.ok(item.sentenceCount > 10);
  }

  assert.equal(
    new Set(manifest.test.map((item) => item.pmcid)).size,
    manifest.test.length
  );

  const datasetCounts = {};
  const modelCounts = {};
  const pairCounts = {};
  for (const item of manifest.test) {
    datasetCounts[item.dataset] = (datasetCounts[item.dataset] ?? 0) + 1;
    modelCounts[item.model] = (modelCounts[item.model] ?? 0) + 1;
    pairCounts[`${item.model}__${item.dataset}`] =
      (pairCounts[`${item.model}__${item.dataset}`] ?? 0) + 1;
  }

  for (const model of metadata.model_order) {
    for (const dataset of metadata.dataset_order) {
      assert.ok(
        (pairCounts[`${model}__${dataset}`] ?? 0) >= 1,
        `Expected at least one test case for ${model} ${dataset}`
      );
    }
  }

  assert.ok(
    datasetCounts["medmcqa-filtered"] <= 45,
    "Expected MedMCQA to no longer dominate the 100-case pool"
  );
  assert.ok(
    datasetCounts.medqa >= 25,
    "Expected MedQA to have a substantial share of the 100-case pool"
  );
  assert.ok(
    datasetCounts["nejm-cpc"] >= 20,
    "Expected NEJM to have a substantial share of the 100-case pool"
  );

  assert.ok(
    modelCounts["deepseek-r1-distill-qwen-1.5b"] <= 20,
    "Expected Qwen 1.5B to no longer dominate the 100-case pool"
  );
  assert.ok(
    modelCounts["deepseek-r1-distill-llama-8b"] <= 20,
    "Expected Llama 8B to no longer dominate the 100-case pool"
  );
  assert.ok(
    modelCounts["deepseek-r1-distill-qwen-14b"] <= 20,
    "Expected Qwen 14B to stay in the same rough range as the other scored models"
  );
  assert.ok(
    modelCounts["gpt-oss-20b"] >= 10,
    "Expected GPT OSS to have a meaningful share of the 100-case pool"
  );
  assert.ok(
    modelCounts["huatuogpt-o1-8b"] >= 10,
    "Expected Huatuo to have a meaningful share of the 100-case pool"
  );
  assert.ok(
    modelCounts["qwq-32b"] >= 10,
    "Expected QWQ to have a meaningful share of the 100-case pool"
  );

  const scored = manifest.test.filter((item) => item.agreementKappa !== null);
  const average = (items) =>
    items.reduce((sum, item) => sum + item.agreementKappa, 0) / items.length;
  assert.ok(
    average(scored.slice(0, 20)) > average(scored.slice(-20)),
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

  const kevinAnchors = new Set([
    "650e00e273df4f2b947cf25779cd1f83",
    "edfb730a1ed7cb41432f607c2134cfb9",
    "ec82fabb228f5b057ecb257a67cdefd2",
    "5e04571b261b905a9c392cfc1d1e189a",
    "f0e63b7ab7df33642365023abf1fc824",
    "1a52d111ac0e384ba9320b380d620263",
    "d4baf72f24008ddb038fa75c3afb1a05",
    "f91a7e9f404b2c52f57b2b68390f0cd4",
    "2ab3d10d8ea8d04a6cc0ea22a424b471",
  ]);
  for (const pmcid of kevinAnchors) {
    assert.ok(
      manifest.test.some((item) => item.pmcid === pmcid),
      `Expected Kevin anchor case ${pmcid} to remain in the pool`
    );
  }

  assert.ok(
    new Set(manifest.test.slice(0, 12).map((item) => item.model)).size >= 3,
    "Expected the first 12 visible test cases to include multiple models"
  );
  assert.ok(
    new Set(manifest.test.slice(0, 12).map((item) => item.dataset)).size >= 2,
    "Expected the first 12 visible test cases to mix multiple datasets"
  );
});
