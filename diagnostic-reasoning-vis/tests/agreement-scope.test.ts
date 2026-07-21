import test from "node:test";
import assert from "node:assert/strict";

async function loadAgreementScope() {
  return import(new URL("../lib/agreement-scope.ts", import.meta.url).href);
}

test("buildAgreementCasesMap keeps only cases present in the active labeler pool", async () => {
  const { buildAgreementCasesMap } = await loadAgreementScope();

  const casesMap = {
    "model-a_medqa": [
      { id: "case-a0" },
      { id: "case-a1" },
      { id: "case-a2" },
    ],
    "model-b_nejm-cpc": [
      { id: "case-b0" },
      { id: "case-b1" },
    ],
    "model-c_medqa": [
      { id: "case-c0" },
    ],
  };

  const labelerPool = [
    { model: "model-a", dataset: "medqa", caseIndex: 1, index: 3 },
    { model: "model-b", dataset: "nejm-cpc", caseIndex: 0, index: 4 },
  ];

  assert.deepEqual(buildAgreementCasesMap(casesMap, labelerPool), {
    "model-a_medqa": [{ id: "case-a1" }],
    "model-b_nejm-cpc": [{ id: "case-b0" }],
  });
});
