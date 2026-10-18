#!/usr/bin/env python3
"""Build the labeler pool for the labeler pipeline (LABELER_PIPELINE in lib/constants.ts).

Writes public/data/pipelines/<PIPELINE>/labeler-pool.json — a flat array of
{index, model, caseIndex, caseId, sentenceCount, isTraining}, consumed by
hooks/useSamplePool.ts. `caseIndex` indexes into cases/{model}.json.

  - Training: 5 cases, each from a DIFFERENT model — 2 medqa, 1 medmcqa, 2 nejm.
  - Test: 120 cases, balanced to exactly 20 per model and 40 per dataset
    (each model contributes 7/7/6 across the 3 datasets), seeded, disjoint from training.

Deterministic (fixed seed) so the pool never drifts between runs.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = "gwot"
SRC = ROOT / "public" / "data" / "pipelines" / PIPELINE
MODELS = [
    "deepseek-r1-distill-llama-8b", "deepseek-r1-distill-qwen-1.5b",
    "deepseek-r1-distill-qwen-14b", "gpt-oss-20b", "huatuogpt-o1-8b", "qwq-32b",
]
DATASETS = ["medqa", "medmcqa-filtered", "nejm-cpc"]
SEED = 42


def load_strata():
    """model -> dataset -> list of (caseIndex, caseId, sentenceCount)."""
    strata: dict[str, dict[str, list[tuple]]] = {}
    for m in MODELS:
        cases = json.load(open(SRC / "cases" / f"{m}.json"))
        by_ds: dict[str, list[tuple]] = {d: [] for d in DATASETS}
        for i, c in enumerate(cases):
            ds = c.get("dataset")
            if ds in by_ds:
                by_ds[ds].append((i, c["id"], len(c["sentences"])))
        strata[m] = by_ds
    return strata


def main() -> None:
    rng = random.Random(SEED)
    strata = load_strata()
    used: set[tuple[str, int]] = set()  # (model, caseIndex)
    entries: list[dict] = []

    def take(model: str, dataset: str) -> tuple:
        pool = [x for x in strata[model][dataset] if (model, x[0]) not in used]
        pick = rng.choice(pool)
        used.add((model, pick[0]))
        return pick

    # ---- Training: 5 distinct models, roles 2×medqa / 1×medmcqa / 2×nejm ----
    roles = ["medqa", "medqa", "medmcqa-filtered", "nejm-cpc", "nejm-cpc"]
    train_models = rng.sample(MODELS, 5)
    for (model, dataset) in zip(train_models, roles):
        ci, cid, sc = take(model, dataset)
        entries.append({"index": len(entries), "model": model, "caseIndex": ci,
                        "caseId": cid, "sentenceCount": sc, "isTraining": True})

    # ---- Test: 20 per model, 40 per dataset (each model gives 7/7/6) ----
    # Each model's "6" dataset chosen so each dataset is the "6" for exactly 2 models.
    test_entries: list[dict] = []
    for i, model in enumerate(MODELS):
        six_ds = DATASETS[i // 2]
        for dataset in DATASETS:
            n = 6 if dataset == six_ds else 7
            for _ in range(n):
                ci, cid, sc = take(model, dataset)
                test_entries.append({"model": model, "caseIndex": ci,
                                     "caseId": cid, "sentenceCount": sc, "isTraining": False})
    # Shuffle so the test cases appear in a random (not model-grouped) order.
    rng.shuffle(test_entries)
    for e in test_entries:
        e["index"] = len(entries)
        entries.append(e)

    out = SRC / "labeler-pool.json"
    out.write_text(json.dumps(entries, ensure_ascii=False, indent=2))

    # report marginals
    from collections import Counter
    test = [e for e in entries if not e["isTraining"]]
    per_model = Counter(e["model"] for e in test)

    def ds_of(e):
        for m in MODELS:
            for d in DATASETS:
                if any(x[0] == e["caseIndex"] and x[1] == e["caseId"] for x in strata[e["model"]][d]):
                    return d
        return "?"
    per_ds = Counter(ds_of(e) for e in test)
    print(f"wrote {out} — {len(entries)} entries "
          f"(5 training, {len(test)} test)")
    print("  test per model:", dict(per_model))
    print("  test per dataset:", dict(per_ds))
    print("  training:", [(e["model"], ds_of(e)) for e in entries if e["isTraining"]])


if __name__ == "__main__":
    main()
