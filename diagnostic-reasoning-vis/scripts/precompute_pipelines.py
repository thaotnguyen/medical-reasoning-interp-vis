#!/usr/bin/env python3
"""Precompute geometric-pipeline data files for the diagnostic-reasoning-vis app.

Outputs:
    public/data/pipelines/geometric/cases/{model}.json
    public/data/pipelines/geometric/points/{model}.json
    public/data/pipelines/geometric/taxonomy.json

Usage:
    python scripts/precompute_pipelines.py
"""
from __future__ import annotations

import argparse
import json
import pickle
import sys
from pathlib import Path

import numpy as np

# ---- Configuration ------------------------------------------------------

WHITE_BOX_DATA = Path("/home/ttn/Development/med-interp/white_box_data")
ACTIVATIONS_DIR = Path(
    "/home/ttn/Development/med-interp/thinking-llms-interp/generate-responses/results/vars"
)

REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = REPO_ROOT / "public" / "data" / "pipelines"

# Best (layer) per model used to build the geometric taxonomy
# (matches train-saes/build_geometric_taxonomy.py inputs).
GEOMETRIC_LAYERS: dict[str, int] = {
    "qwq-32b": 27,
    "gpt-oss-20b": 17,
    "deepseek-r1-distill-qwen-14b": 20,
    "huatuogpt-o1-8b": 6,
    "deepseek-r1-distill-llama-8b": 14,
    "deepseek-r1-distill-qwen-1.5b": 12,
}

# Default 12-color palette (must match lib/constants.ts TAXONOMY_COLORS).
PALETTE = [
    "#9467bd", "#ff7f0e", "#1f77b4", "#e377c2", "#2ca02c", "#d62728",
    "#8c564b", "#17becf", "#bcbd22", "#7f7f7f", "#5b8def", "#e7969c",
]


def _short_name(label: str) -> str:
    s = label.split("(", 1)[0].split(",", 1)[0].split(":", 1)[0].strip()
    s = " ".join(s.split())
    if len(s) > 28:
        s = s[:27].rstrip(" -/") + "…"
    return s or label


def write_taxonomy(labeled: dict, models: list[str]) -> None:
    out_dir = PUBLIC_DIR / "geometric"
    out_dir.mkdir(parents=True, exist_ok=True)
    states = []
    for i, label in enumerate(labeled["state_order"]):
        states.append({
            "label": label,
            "short_name": _short_name(label),
            "color": PALETTE[i % len(PALETTE)],
        })
    payload = {
        "pipeline": "geometric",
        "states": states,
        "has_dataset": False,
        "models": models,
    }
    (out_dir / "taxonomy.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2)
    )


def build_cases_from_labeled(
    labeled: dict, model: str
) -> tuple[list[dict], dict[str, int]]:
    """Flatten a results_geometric.labeled.json into [{Case}, ...].

    Returns (cases, pmcid_to_caseidx). The case id is namespaced by model
    so cross-model cases never collide.
    """
    cases: list[dict] = []
    pmcid_to_idx: dict[str, int] = {}
    state_to_idx: dict[str, int] = labeled.get("state_to_idx", {})
    for trace in labeled.get("traces", []):
        pmcid = trace["pmcid"]
        key = f"{model}::{pmcid}"

        label_json = trace.get("label_json") or {}
        if isinstance(label_json, str):
            try:
                label_json = json.loads(label_json)
            except Exception:
                label_json = {}

        items: list[tuple[int, dict]]
        if isinstance(label_json, dict):
            items = sorted(
                ((int(k), v) for k, v in label_json.items() if str(k).isdigit()),
                key=lambda t: t[0],
            )
        elif isinstance(label_json, list):
            items = list(enumerate(label_json, start=1))
        else:
            items = []

        sentences = []
        for one_based, item in items:
            text = item.get("sentence", "") if isinstance(item, dict) else ""
            func = item.get("function", "") if isinstance(item, dict) else ""
            t = state_to_idx.get(func, -1)
            sentences.append({
                "s": text,
                "t": t,
                "c": None,
                "i": one_based,
                "x": None,
                "y": None,
            })

        if key in pmcid_to_idx:
            continue
        pmcid_to_idx[key] = len(cases)
        cases.append({
            "id": key,
            "qid": trace.get("question_id"),
            "prompt": trace.get("case_prompt", ""),
            "true_dx": trace.get("true_diagnosis", ""),
            "pred_dx": trace.get("predicted_diagnosis", ""),
            "correct": bool(trace.get("verified_correct", False)),
            "sentences": sentences,
        })
    return cases, pmcid_to_idx


def project_2d(features: np.ndarray, max_points: int | None = None,
               seed: int = 42) -> np.ndarray:
    """N×D -> N×2 via PCA(→50) + t-SNE, sub-sampled when very large."""
    from sklearn.decomposition import PCA
    from sklearn.manifold import TSNE

    n = features.shape[0]
    if features.shape[1] > 50:
        pca = PCA(n_components=50, random_state=seed)
        x = pca.fit_transform(features)
    else:
        x = features
    if max_points is not None and n > max_points:
        rng = np.random.default_rng(seed)
        sample = rng.choice(n, max_points, replace=False)
        sample.sort()
        ts = TSNE(n_components=2, init="pca", random_state=seed, perplexity=30)
        emb_sample = ts.fit_transform(x[sample])
        from sklearn.neighbors import NearestNeighbors
        nn = NearestNeighbors(n_neighbors=1).fit(x[sample])
        idx = nn.kneighbors(x, return_distance=False)[:, 0]
        emb = emb_sample[idx]
    else:
        ts = TSNE(n_components=2, init="pca", random_state=seed, perplexity=30)
        emb = ts.fit_transform(x)
    return emb.astype(np.float32)


# ---- Geometric pipeline -------------------------------------------------

def emit_geometric_model(model: str, layer: int, tsne_max: int) -> dict | None:
    """Write cases/points JSON for a single model. Returns the labeled dict."""
    labeled_path = WHITE_BOX_DATA / model / "all" / "results_geometric.labeled.json"
    if not labeled_path.exists():
        print(f"  [skip] {labeled_path} missing")
        return None
    labeled = json.loads(labeled_path.read_text())
    cases, pmcid_to_idx = build_cases_from_labeled(labeled, model)

    act_file = ACTIVATIONS_DIR / f"activations_{model}_100000_{layer}.pkl"
    if not act_file.exists():
        print(f"  [warn] {act_file.name} missing — emitting cases without points")
        coords = None
        idx_tuples = []
    else:
        print(f"  loading {act_file.name}")
        feats, _texts, idx_tuples, _last = pickle.load(open(act_file, "rb"))
        feats = np.asarray(feats)
        print(f"  projecting {feats.shape[0]} × {feats.shape[1]} → 2D")
        coords = project_2d(feats, max_points=tsne_max)

    out_dir = PUBLIC_DIR / "geometric"
    (out_dir / "cases").mkdir(parents=True, exist_ok=True)
    (out_dir / "points").mkdir(parents=True, exist_ok=True)

    points: list[list[float | int]] = []
    if coords is not None:
        for i, key_tuple in enumerate(idx_tuples):
            pmcid, sent_idx_zero_based = key_tuple
            namespaced = f"{model}::{pmcid}"
            case_idx = pmcid_to_idx.get(namespaced, -1)
            if case_idx < 0:
                continue
            case = cases[case_idx]
            sent_one = sent_idx_zero_based + 1
            t = -1
            for s in case["sentences"]:
                if s["i"] == sent_one:
                    t = s["t"]
                    break
            x, y = coords[i]
            points.append([
                round(float(x), 2), round(float(y), 2),
                int(t), 0, int(case_idx), int(sent_one - 1),
            ])

    (out_dir / "cases" / f"{model}.json").write_text(
        json.dumps(cases, ensure_ascii=False, separators=(",", ":"))
    )
    (out_dir / "points" / f"{model}.json").write_text(
        json.dumps(points, separators=(",", ":"))
    )
    print(f"  wrote {len(cases)} cases, {len(points)} points for {model}")
    return labeled


def emit_geometric(tsne_max: int, only_model: str | None = None) -> None:
    last_labeled: dict | None = None
    models_emitted: list[str] = []
    target = (
        [only_model] if only_model else list(GEOMETRIC_LAYERS.keys())
    )
    for model in target:
        layer = GEOMETRIC_LAYERS.get(model)
        if layer is None:
            print(f"  [skip] no layer mapping for {model}")
            continue
        print(f"[{model}] layer={layer}")
        result = emit_geometric_model(model, layer, tsne_max)
        if result is not None:
            last_labeled = result
            models_emitted.append(model)
    if last_labeled is not None:
        write_taxonomy(last_labeled, models_emitted)
        print(f"wrote taxonomy for {len(models_emitted)} models")
    else:
        print("[error] no models emitted; taxonomy not written", file=sys.stderr)


# ---- CLI ----------------------------------------------------------------

def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pipeline", choices=["geometric"], default="geometric")
    p.add_argument("--model", help="Emit only this model (default: all 6).")
    p.add_argument("--tsne-max", type=int, default=20000,
                   help="Max points fit by t-SNE; remaining points 1-NN extended.")
    args = p.parse_args(argv)
    emit_geometric(args.tsne_max, args.model)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
