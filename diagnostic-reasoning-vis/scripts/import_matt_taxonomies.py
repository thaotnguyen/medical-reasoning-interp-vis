#!/usr/bin/env python3
"""Import Matt's K=5 and K=7 taxonomies as viewer pipelines (`matt5`, `matt7`).

Source: matt-visualizations/Visualisations/vis_*_K{5,7}_direct_combined.data.json, the data
blob his standalone Plotly HTML embeds. Each file is

    {run, views[15], models[7], groups[K], glabels{group -> label}}

and a view is {name, points[], traces{}} where a point is
{i, x, y, g, m, p, s, t} = index, coords, group, model, pmcid, sentence index, sentence text,
and traces maps "{model}|{pmcid}" -> the ordered point indices of that trace.

The 15 views hold the *same* sentences with the *same* groups in different coordinate spaces.
We take `couplings` — the one his HTML opens on — because it is a single cross-model space, so
positions stay comparable as you switch models in the viewer.

Two things this has to be careful about, both verified against the source:

* `s` is not a position. Six gpt-oss-20b traces have gaps (56 points but max(s)=57, i.e. Matt
  dropped some sentences), so `sent_idx` is the position within traces[key], never `s`.
* Matt's sentence splitting is not quite the viewer's — 594/600 traces match `dedup` exactly,
  the same six differ by one sentence. So sentences come from Matt's own points, and only
  case-level metadata (prompt / diagnoses / correct / dataset) is joined from `dedup` by pmcid.
  Never join sentence-by-sentence.

Output per pipeline, matching the shapes hooks/usePipeline{Cases,Points,Taxonomy}.ts expect:

    public/data/pipelines/<p>/taxonomy.json
    public/data/pipelines/<p>/cases/{model}.json
    public/data/pipelines/<p>/points/{model}.json

Usage: python scripts/import_matt_taxonomies.py
"""
from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parents[1] / "matt-visualizations" / "Visualisations"
OUT = ROOT / "public" / "data" / "pipelines"
DEDUP = OUT / "dedup" / "cases"

SOURCES = {
    "matt5": "vis_N1000_L0.5_a0.8_tpl5_kmeansmK8_cenglobal_m6_recdec_seed0__K5_direct_combined.data.json",
    "matt7": "vis_N1000_L0.5_a0.8_tpl7_kmeansmK8_cenglobal_m6_recdec_seed0__K7_direct_combined.data.json",
}

VIEW = "couplings"

# Matt's slugs -> the viewer's.
MODEL_MAP = {
    "gpt-oss-20b": "gpt-oss-20b",
    "huatuo-8b": "huatuogpt-o1-8b",
    "llama-8b": "deepseek-r1-distill-llama-8b",
    "qwen-1.5b": "deepseek-r1-distill-qwen-1.5b",
    "qwen-14b": "deepseek-r1-distill-qwen-14b",
    "qwq-32b": "qwq-32b",
}

# Verbatim from the tail of his HTML, indexed by group order, so the viewer's scatter and
# legend colour these taxonomies exactly as his tool does.
PAL = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948",
    "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac", "#1f77b4", "#d62728",
]

EXAMPLES_PER_STATE = 60
SEED = 0


def load_dedup_meta() -> dict[str, dict]:
    """(viewer_slug, pmcid) -> case metadata from the existing dedup pipeline."""
    meta: dict[str, dict] = {}
    for slug in set(MODEL_MAP.values()):
        for c in json.loads((DEDUP / f"{slug}.json").read_text()):
            meta[f"{slug}::{c['id'].split('::', 1)[1]}"] = c
    return meta


def build(pipeline: str, filename: str, meta: dict[str, dict]) -> None:
    data = json.loads((SRC / filename).read_text())
    view = next(v for v in data["views"] if v["name"] == VIEW)
    points, traces = view["points"], view["traces"]
    glabels = data["glabels"]
    K = len(data["groups"])

    # traces preserves Matt's insertion order, so the viewer's case dropdown follows his.
    per_model: dict[str, list[tuple[str, list[int]]]] = {}
    for key, idxs in traces.items():
        matt_model, pmcid = key.split("|", 1)
        per_model.setdefault(matt_model, []).append((pmcid, idxs))

    pipe_dir = OUT / pipeline
    (pipe_dir / "cases").mkdir(parents=True, exist_ok=True)
    (pipe_dir / "points").mkdir(parents=True, exist_ok=True)

    # group -> [(model, caseIdx, sentIdx, text, dataset, dx)] for the Browser tab's examples
    pool: dict[int, list[dict]] = {g: [] for g in range(K)}
    missing_meta = 0

    for matt_model, entries in per_model.items():
        slug = MODEL_MAP[matt_model]
        cases, pts = [], []

        for case_idx, (pmcid, idxs) in enumerate(entries):
            src = meta.get(f"{slug}::{pmcid}")
            if src is None:
                missing_meta += 1
                continue

            sentences = []
            for sent_idx, pi in enumerate(idxs):
                p = points[pi]
                sentences.append({
                    "s": p["t"],
                    "t": p["g"],
                    "c": None,
                    "i": sent_idx + 1,
                    "x": round(p["x"], 4),
                    "y": round(p["y"], 4),
                })
                pts.append([round(p["x"], 4), round(p["y"], 4), p["g"], 0, case_idx, sent_idx])
                pool[p["g"]].append({
                    "s": p["t"], "model": slug, "caseIdx": case_idx, "sentIdx": sent_idx,
                    "dataset": src.get("dataset"), "dx": src.get("true_dx"),
                })

            cases.append({
                "id": f"{slug}::{pmcid}",
                "qid": src.get("qid"),
                "prompt": src["prompt"],
                "dataset": src.get("dataset"),
                "true_dx": src["true_dx"],
                "pred_dx": src["pred_dx"],
                "correct": src["correct"],
                "sentences": sentences,
            })

        (pipe_dir / "cases" / f"{slug}.json").write_text(json.dumps(cases))
        (pipe_dir / "points" / f"{slug}.json").write_text(json.dumps(pts))
        print(f"  {pipeline}/{slug}: {len(cases)} cases, {len(pts)} points", flush=True)

    rng = random.Random(SEED)
    states = []
    for g in range(K):
        label = glabels[str(g)]
        sample = pool[g]
        if len(sample) > EXAMPLES_PER_STATE:
            sample = rng.sample(sample, EXAMPLES_PER_STATE)
        states.append({
            "label": label,
            "short_name": label,
            "description": f"Matt's cluster G{g}, from his K={K} k-means run.",
            "color": PAL[g % len(PAL)],
            "examples": sample,
        })

    (pipe_dir / "taxonomy.json").write_text(json.dumps({
        "pipeline": pipeline,
        "states": states,
        "has_dataset": False,
        "models": [MODEL_MAP[m] for m in sorted(per_model)],
    }))
    if missing_meta:
        print(f"  WARNING {pipeline}: {missing_meta} traces had no dedup metadata", flush=True)
    print(f"{pipeline}: K={K}, {len(states)} states -> {pipe_dir}", flush=True)


def main() -> None:
    meta = load_dedup_meta()
    for pipeline, filename in SOURCES.items():
        build(pipeline, filename, meta)


if __name__ == "__main__":
    main()
