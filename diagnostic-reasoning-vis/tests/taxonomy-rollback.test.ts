import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TAXONOMY_KEYBOARD_MAP } from "../lib/labeling-types.ts";
import { importRatings, exportRatingsAsCSV } from "../lib/labeling-storage.ts";
import { collectPairedLabels } from "../lib/agreement-stats.ts";

const ROOT = process.cwd();

const EXPECTED_TAXONOMY = [
  "Orchestration",
  "Case Evidence Extraction",
  "Evidence Processing",
  "Hypothesis Generation",
  "Hypothesis Evaluation",
  "Recalling Medical Knowledge",
  "Final Answer",
];

function walkTaxonomyValues(value: unknown, out: Set<number>) {
  if (Array.isArray(value)) {
    for (const item of value) walkTaxonomyValues(item, out);
    return;
  }

  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if (typeof record.t === "number") out.add(record.t);

  for (const child of Object.values(record)) {
    walkTaxonomyValues(child, out);
  }
}

test("metadata exposes the reordered 7-item taxonomy", () => {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(ROOT, "public/data/metadata.json"), "utf8")
  );

  assert.equal(metadata.taxonomy.length, 7);
  assert.deepEqual(
    metadata.taxonomy.map((item: { short_name: string }) => item.short_name),
    EXPECTED_TAXONOMY
  );
});

test("case and t-SNE data use raw taxonomy values 0 through 6", () => {
  const caseValues = new Set<number>();
  const caseDir = path.join(ROOT, "public/data/cases");

  for (const file of fs.readdirSync(caseDir).filter((name) => name.endsWith(".json"))) {
    const parsed = JSON.parse(fs.readFileSync(path.join(caseDir, file), "utf8"));
    walkTaxonomyValues(parsed, caseValues);
  }

  assert.deepEqual([...caseValues].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);

  const tsneValues = new Set<number>();
  const tsneDir = path.join(ROOT, "public/data/tsne");

  for (const file of fs.readdirSync(tsneDir).filter((name) => name.endsWith(".json"))) {
    const points = JSON.parse(fs.readFileSync(path.join(tsneDir, file), "utf8"));
    for (const point of points) {
      if (typeof point?.[2] === "number") tsneValues.add(point[2]);
    }
  }

  assert.deepEqual([...tsneValues].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
});

test("keyboard labeling exposes all seven taxonomy shortcuts", () => {
  assert.deepEqual(TAXONOMY_KEYBOARD_MAP, {
    "1": 0,
    "2": 1,
    "3": 2,
    "4": 3,
    "5": 4,
    "6": 5,
    "7": 6,
  });
});

test("rating import and CSV export preserve raw taxonomy indices", () => {
  const imported = {
    raterA: {
      modelA: {
        datasetA: {
          caseA: {
            0: { taxonomy: 5, timestamp: 1 },
          },
        },
      },
    },
  };

  const merged = importRatings({}, imported);
  assert.equal(
    merged.raterA.modelA.datasetA.caseA[0].taxonomy,
    5,
    "import should not collapse Recalling Medical Knowledge into another category"
  );

  const csv = exportRatingsAsCSV(
    merged,
    {
      modelA_datasetA: [
        {
          id: "caseA",
          sentences: [{ s: "knowledge sentence", t: 5 }],
        },
      ],
    },
    {
      taxonomy: EXPECTED_TAXONOMY.map((short_name) => ({ short_name })),
      models: {
        modelA: {
          datasets: {
            datasetA: {},
          },
        },
      },
    }
  );

  assert.match(csv, /Recalling Medical Knowledge/);
});

test("agreement statistics compare raw taxonomy labels directly", () => {
  const ratings = {
    raterA: {
      modelA: {
        datasetA: {
          caseA: {
            0: { taxonomy: 5, timestamp: 1 },
          },
        },
      },
    },
  };

  const paired = collectPairedLabels(
    ratings,
    [
      {
        id: "caseA",
        sentences: [{ s: "knowledge sentence", t: 5 }],
      },
    ],
    "modelA",
    "datasetA",
    "raterA",
    "whitebox"
  );

  assert.deepEqual(paired, { labelsA: [5], labelsB: [5] });
});
