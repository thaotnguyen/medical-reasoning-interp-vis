#!/usr/bin/env python3
"""Import the GWOT taxonomy as a viewer pipeline (`gwot`).

Source: the frozen fused Gromov-Wasserstein taxonomy in the medcasereasoning-cot-activations
dataset (gated; run `hf auth login` after access is granted):

    recommended_decoding/taxonomies/<SOLVE>/assignments.csv   case_id, model, sentence_index,
                                                              group, text
    recommended_decoding/taxonomies/<SOLVE>/labels.csv        group, point, name, description

It assigns every sentence of 500 cases per model, for 10 models, to one of 6 groups.

Sentences and groups come from the taxonomy itself. Case-level metadata (prompt / diagnoses /
correct / dataset) is joined from `tenmodel` by case id, never sentence by sentence, because the
four newer models split some sentences differently there.

The taxonomy has no 2-D layout of its own, so each sentence takes the scatter position of the
sentence with the same text in the same case of `tenmodel`. That covers every sentence of the
six original models and 88-94% of the four newer ones; an unmatched sentence keeps its group
in the trace view but has no point in the scatter.

Output, matching the shapes hooks/usePipeline{Cases,Points,Taxonomy}.ts expect:

    public/data/pipelines/gwot/taxonomy.json
    public/data/pipelines/gwot/cases/{model}.json
    public/data/pipelines/gwot/points/{model}.json

Usage: python scripts/import_gwot_taxonomy.py
"""
from __future__ import annotations

import csv
import json
import random
from collections import defaultdict
from pathlib import Path

from huggingface_hub import hf_hub_download

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "pipelines"
TENMODEL = OUT / "tenmodel"
PIPELINE = "gwot"

DATASET = "matthewshu/medcasereasoning-cot-activations"
SOLVE = "resid_srfgw_uniform_N500_a0.8_K6_m10_seed2031_b24"

PAL = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948",
    "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac", "#1f77b4", "#d62728",
]

EXAMPLES_PER_STATE = 60
SEED = 0


def source(name: str) -> Path:
    return Path(hf_hub_download(DATASET, f"recommended_decoding/taxonomies/{SOLVE}/{name}",
                                repo_type="dataset"))


def main() -> None:
    with source("labels.csv").open() as handle:
        labels = sorted(csv.DictReader(handle), key=lambda r: int(r["group"]))
    traces: dict[tuple[str, str], list[dict]] = defaultdict(list)
    with source("assignments.csv").open() as handle:
        for row in csv.DictReader(handle):
            traces[row["model"], row["case_id"]].append(row)

    models = json.loads((TENMODEL / "taxonomy.json").read_text())["models"]
    (OUT / PIPELINE / "cases").mkdir(parents=True, exist_ok=True)
    (OUT / PIPELINE / "points").mkdir(parents=True, exist_ok=True)
    pool: dict[int, list[dict]] = {g: [] for g in range(len(labels))}

    for slug in models:
        cases, pts, placed, total = [], [], 0, 0
        # The viewer's case order, restricted to the cases the taxonomy assigned.
        for src in json.loads((TENMODEL / "cases" / f"{slug}.json").read_text()):
            rows = traces.get((slug, src["id"].split("::", 1)[1]))
            if not rows:
                continue
            case_idx = len(cases)
            position = {}
            for s in src["sentences"]:
                position.setdefault(s["s"].strip(), (s["x"], s["y"]))
            sentences = []
            for sent_idx, row in enumerate(sorted(rows, key=lambda r: int(r["sentence_index"]))):
                group, text = int(row["group"]), row["text"]
                x, y = position.get(text.strip(), (None, None))
                sentences.append({"s": text, "t": group, "c": None, "i": sent_idx + 1, "x": x, "y": y})
                total += 1
                if x is not None:
                    placed += 1
                    pts.append([x, y, group, 0, case_idx, sent_idx])
                pool[group].append({"s": text, "model": slug, "caseIdx": case_idx,
                                    "sentIdx": sent_idx, "dataset": src.get("dataset"),
                                    "dx": src.get("true_dx")})
            cases.append({**{k: src.get(k) for k in ("id", "qid", "prompt", "dataset", "true_dx",
                                                     "pred_dx", "correct")},
                          "sentences": sentences})

        (OUT / PIPELINE / "cases" / f"{slug}.json").write_text(json.dumps(cases))
        (OUT / PIPELINE / "points" / f"{slug}.json").write_text(json.dumps(pts))
        print(f"  {slug}: {len(cases)} cases, {placed}/{total} sentences placed", flush=True)

    rng = random.Random(SEED)
    states = []
    for label in labels:
        group = int(label["group"])
        sample = pool[group]
        if len(sample) > EXAMPLES_PER_STATE:
            sample = rng.sample(sample, EXAMPLES_PER_STATE)
        states.append({"label": label["name"], "short_name": label["name"],
                       "description": label["description"], "color": PAL[group % len(PAL)],
                       "examples": sample})

    (OUT / PIPELINE / "taxonomy.json").write_text(json.dumps({
        "pipeline": PIPELINE, "states": states, "has_dataset": False, "models": models,
    }))
    print(f"{PIPELINE}: {len(states)} states -> {OUT / PIPELINE}", flush=True)


if __name__ == "__main__":
    main()
