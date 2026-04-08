import test from "node:test";
import assert from "node:assert/strict";

async function loadLabelerUi() {
  return import(new URL("../lib/labeler-ui.ts", import.meta.url).href);
}

test("getPoolPhase marks the first three pool entries as training and the rest as test", async () => {
  const { getPoolPhase } = await loadLabelerUi();

  assert.equal(getPoolPhase(0), "training");
  assert.equal(getPoolPhase(1), "training");
  assert.equal(getPoolPhase(2), "training");
  assert.equal(getPoolPhase(3), "test");
  assert.equal(getPoolPhase(12), "test");
});

test("getPoolPhase honors explicit training items even if the index shifts", async () => {
  const { getPoolPhase } = await loadLabelerUi();

  assert.equal(getPoolPhase(5, true), "training");
});

test("consumePointerAction stops bubbling before running the selection callback", async () => {
  const { consumePointerAction } = await loadLabelerUi();
  const calls: string[] = [];

  consumePointerAction(
    {
      stopPropagation() {
        calls.push("stop");
      },
    },
    () => {
      calls.push("select");
    }
  );

  assert.deepEqual(calls, ["stop", "select"]);
});
