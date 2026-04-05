import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCaseCandidateFromTraces,
  buildIndexedLabelerPool,
  selectCasesByCellTargets,
  shuffleSelectedCasesDeterministically,
  sortAndSelectTestCases,
} from "../lib/labeler-pool.ts";

function makeTrace({
  pmcid = "pmcid-1",
  questionId = "qid-1",
  prompt = "Case prompt",
  sentences,
  sequence,
}) {
  return {
    pmcid,
    question_id: questionId,
    case_prompt: prompt,
    label_json: Object.fromEntries(
      sentences.map((sentence, index) => [
        String(index + 1),
        { sentence, function: sequence[index] },
      ])
    ),
    sequence,
  };
}

test("buildCaseCandidateFromTraces only accepts exact same-trace pairs and computes kappa", () => {
  const identicalSentences = [
    "s1",
    "s2",
    "s3",
    "s4",
    "s5",
    "s6",
    "s7",
    "s8",
    "s9",
    "s10",
    "s11",
  ];

  const valid = buildCaseCandidateFromTraces({
    model: "model-a",
    dataset: "medqa",
    whiteTrace: makeTrace({
      pmcid: "case-1",
      questionId: 7,
      prompt: "Prompt A",
      sentences: identicalSentences,
      sequence: [0, 1, 0, 1, 2, 2, 3, 3, 4, 5, 6],
    }),
    blackTrace: makeTrace({
      pmcid: "case-1",
      questionId: 7,
      prompt: "Prompt A",
      sentences: identicalSentences,
      sequence: [0, 1, 0, 1, 2, 2, 3, 3, 4, 5, 6],
    }),
  });

  assert.ok(valid);
  assert.equal(valid.model, "model-a");
  assert.equal(valid.dataset, "medqa");
  assert.equal(valid.pmcid, "case-1");
  assert.equal(valid.questionId, 7);
  assert.equal(valid.sentenceCount, 11);
  assert.equal(valid.agreementKappa, 1);

  const mismatchedSentences = buildCaseCandidateFromTraces({
    model: "model-a",
    dataset: "medqa",
    whiteTrace: makeTrace({
      pmcid: "case-2",
      questionId: 8,
      prompt: "Prompt B",
      sentences: identicalSentences,
      sequence: [0, 1, 0, 1, 2, 2, 3, 3, 4, 5, 6],
    }),
    blackTrace: makeTrace({
      pmcid: "case-2",
      questionId: 8,
      prompt: "Prompt B",
      sentences: [...identicalSentences.slice(0, 10), "different"],
      sequence: [0, 1, 0, 1, 2, 2, 3, 3, 4, 5, 6],
    }),
  });

  assert.equal(mismatchedSentences, null);

  const tooShort = buildCaseCandidateFromTraces({
    model: "model-a",
    dataset: "medqa",
    whiteTrace: makeTrace({
      pmcid: "case-3",
      questionId: 9,
      prompt: "Prompt C",
      sentences: identicalSentences.slice(0, 10),
      sequence: [0, 1, 0, 1, 2, 2, 3, 3, 4, 5],
    }),
    blackTrace: makeTrace({
      pmcid: "case-3",
      questionId: 9,
      prompt: "Prompt C",
      sentences: identicalSentences.slice(0, 10),
      sequence: [0, 1, 0, 1, 2, 2, 3, 3, 4, 5],
    }),
  });

  assert.equal(tooShort, null);
});

test("sortAndSelectTestCases ranks by kappa, deduplicates pmcid, and applies stable tie-breaks", () => {
  const selected = sortAndSelectTestCases(
    [
      {
        model: "model-b",
        dataset: "medqa",
        pmcid: "shared",
        questionId: 1,
        prompt: "shared prompt",
        sentenceCount: 14,
        agreementKappa: 0.75,
        caseIndex: 12,
      },
      {
        model: "model-a",
        dataset: "nejm-cpc",
        pmcid: "unique-1",
        questionId: 2,
        prompt: "prompt 1",
        sentenceCount: 13,
        agreementKappa: 0.8,
        caseIndex: 5,
      },
      {
        model: "model-a",
        dataset: "medqa",
        pmcid: "shared",
        questionId: 1,
        prompt: "shared prompt",
        sentenceCount: 18,
        agreementKappa: 0.81,
        caseIndex: 7,
      },
      {
        model: "model-a",
        dataset: "medmcqa-filtered",
        pmcid: "unique-2",
        questionId: 3,
        prompt: "prompt 2",
        sentenceCount: 20,
        agreementKappa: 0.8,
        caseIndex: 9,
      },
    ],
    3,
    ["medqa", "medmcqa-filtered", "nejm-cpc"]
  );

  assert.deepEqual(
    selected.map((item) => ({
      pmcid: item.pmcid,
      model: item.model,
      dataset: item.dataset,
      agreementKappa: item.agreementKappa,
    })),
    [
      {
        pmcid: "shared",
        model: "model-a",
        dataset: "medqa",
        agreementKappa: 0.81,
      },
      {
        pmcid: "unique-2",
        model: "model-a",
        dataset: "medmcqa-filtered",
        agreementKappa: 0.8,
      },
      {
        pmcid: "unique-1",
        model: "model-a",
        dataset: "nejm-cpc",
        agreementKappa: 0.8,
      },
    ]
  );
});

test("buildIndexedLabelerPool prepends training entries before ranked test entries", () => {
  const pool = buildIndexedLabelerPool({
    training: [
      {
        model: "claude-3-7-sonnet-20250219",
        dataset: "medqa",
        caseIndex: 0,
        isTraining: true,
      },
    ],
    test: [
      {
        model: "model-a",
        dataset: "medqa",
        caseIndex: 4,
        pmcid: "case-10",
        sentenceCount: 17,
        agreementKappa: 0.71,
      },
      {
        model: "model-b",
        dataset: "nejm-cpc",
        caseIndex: 2,
        pmcid: "case-11",
        sentenceCount: 15,
        agreementKappa: 0.63,
      },
    ],
  });

  assert.deepEqual(
    pool.map((item) => ({
      index: item.index,
      model: item.model,
      dataset: item.dataset,
      caseIndex: item.caseIndex,
      isTraining: !!item.isTraining,
    })),
    [
      {
        index: 0,
        model: "claude-3-7-sonnet-20250219",
        dataset: "medqa",
        caseIndex: 0,
        isTraining: true,
      },
      {
        index: 1,
        model: "model-a",
        dataset: "medqa",
        caseIndex: 4,
        isTraining: false,
      },
      {
        index: 2,
        model: "model-b",
        dataset: "nejm-cpc",
        caseIndex: 2,
        isTraining: false,
      },
    ]
  );
});

test("selectCasesByCellTargets fills each requested cell while skipping duplicate pmcids", () => {
  const selected = selectCasesByCellTargets(
    [
      {
        model: "llama",
        dataset: "medqa",
        pmcid: "dup-1",
        questionId: 1,
        prompt: "prompt",
        sentenceCount: 18,
        agreementKappa: 0.95,
        caseIndex: 0,
      },
      {
        model: "llama",
        dataset: "medqa",
        pmcid: "llama-unique",
        questionId: 2,
        prompt: "prompt",
        sentenceCount: 17,
        agreementKappa: 0.91,
        caseIndex: 1,
      },
      {
        model: "qwen14",
        dataset: "medqa",
        pmcid: "dup-1",
        questionId: 3,
        prompt: "prompt",
        sentenceCount: 16,
        agreementKappa: 0.94,
        caseIndex: 2,
      },
      {
        model: "qwen14",
        dataset: "medqa",
        pmcid: "qwen-unique",
        questionId: 4,
        prompt: "prompt",
        sentenceCount: 15,
        agreementKappa: 0.84,
        caseIndex: 3,
      },
      {
        model: "gpt-oss",
        dataset: "nejm-cpc",
        pmcid: "gpt-1",
        questionId: 5,
        prompt: "prompt",
        sentenceCount: 14,
        agreementKappa: 0.77,
        caseIndex: 4,
      },
    ],
    [
      { model: "llama", dataset: "medqa", count: 1 },
      { model: "qwen14", dataset: "medqa", count: 1 },
      { model: "gpt-oss", dataset: "nejm-cpc", count: 1 },
    ],
    ["medqa", "medmcqa-filtered", "nejm-cpc"]
  );

  assert.deepEqual(
    selected.map((item) => ({
      model: item.model,
      dataset: item.dataset,
      pmcid: item.pmcid,
    })),
    [
      { model: "llama", dataset: "medqa", pmcid: "dup-1" },
      { model: "qwen14", dataset: "medqa", pmcid: "qwen-unique" },
      { model: "gpt-oss", dataset: "nejm-cpc", pmcid: "gpt-1" },
    ]
  );
});

test("shuffleSelectedCasesDeterministically keeps kappa high near the top while minimizing adjacent cell repeats", () => {
  const countAdjacentRepeats = (items) => {
    let repeats = 0;
    for (let i = 1; i < items.length; i++) {
      if (
        items[i - 1].model === items[i].model &&
        items[i - 1].dataset === items[i].dataset
      ) {
        repeats++;
      }
    }
    return repeats;
  };

  const cases = [
    {
      model: "llama",
      dataset: "medqa",
      pmcid: "a1",
      questionId: 1,
      prompt: "prompt",
      sentenceCount: 12,
      agreementKappa: 1.0,
      caseIndex: 0,
    },
    {
      model: "llama",
      dataset: "medqa",
      pmcid: "a2",
      questionId: 2,
      prompt: "prompt",
      sentenceCount: 13,
      agreementKappa: 0.95,
      caseIndex: 1,
    },
    {
      model: "llama",
      dataset: "medqa",
      pmcid: "a3",
      questionId: 3,
      prompt: "prompt",
      sentenceCount: 14,
      agreementKappa: 0.9,
      caseIndex: 2,
    },
    {
      model: "qwen14",
      dataset: "medqa",
      pmcid: "b1",
      questionId: 4,
      prompt: "prompt",
      sentenceCount: 15,
      agreementKappa: 0.85,
      caseIndex: 3,
    },
    {
      model: "qwen14",
      dataset: "medqa",
      pmcid: "b2",
      questionId: 5,
      prompt: "prompt",
      sentenceCount: 16,
      agreementKappa: 0.8,
      caseIndex: 4,
    },
    {
      model: "gpt-oss",
      dataset: "nejm-cpc",
      pmcid: "c1",
      questionId: 6,
      prompt: "prompt",
      sentenceCount: 17,
      agreementKappa: 0.75,
      caseIndex: 5,
    },
  ];

  const shuffledA = shuffleSelectedCasesDeterministically(cases, 123);
  const shuffledB = shuffleSelectedCasesDeterministically(cases, 123);

  assert.deepEqual(
    shuffledA.map((item) => item.pmcid),
    shuffledB.map((item) => item.pmcid)
  );
  assert.notDeepEqual(
    shuffledA.map((item) => item.pmcid),
    cases.map((item) => item.pmcid)
  );
  assert.deepEqual(
    [...shuffledA.map((item) => item.pmcid)].sort(),
    [...cases.map((item) => item.pmcid)].sort()
  );

  assert.equal(shuffledA[0].pmcid, "a1");
  assert.equal(countAdjacentRepeats(shuffledA), 0);

  const average = (items) =>
    items.reduce((sum, item) => sum + item.agreementKappa, 0) / items.length;
  assert.ok(
    average(shuffledA.slice(0, 3)) > average(shuffledA.slice(-3)),
    "Expected earlier visible cases to have stronger agreement than later ones"
  );

  const impossibleMix = [
    {
      model: "llama",
      dataset: "medqa",
      pmcid: "x1",
      questionId: 1,
      prompt: "prompt",
      sentenceCount: 12,
      agreementKappa: 1.0,
      caseIndex: 0,
    },
    {
      model: "llama",
      dataset: "medqa",
      pmcid: "x2",
      questionId: 2,
      prompt: "prompt",
      sentenceCount: 13,
      agreementKappa: 0.95,
      caseIndex: 1,
    },
    {
      model: "llama",
      dataset: "medqa",
      pmcid: "x3",
      questionId: 3,
      prompt: "prompt",
      sentenceCount: 14,
      agreementKappa: 0.9,
      caseIndex: 2,
    },
    {
      model: "llama",
      dataset: "medqa",
      pmcid: "x4",
      questionId: 4,
      prompt: "prompt",
      sentenceCount: 15,
      agreementKappa: 0.85,
      caseIndex: 3,
    },
    {
      model: "qwen14",
      dataset: "medqa",
      pmcid: "y1",
      questionId: 5,
      prompt: "prompt",
      sentenceCount: 16,
      agreementKappa: 0.8,
      caseIndex: 4,
    },
  ];

  assert.equal(
    countAdjacentRepeats(shuffleSelectedCasesDeterministically(impossibleMix, 123)),
    2
  );
});
