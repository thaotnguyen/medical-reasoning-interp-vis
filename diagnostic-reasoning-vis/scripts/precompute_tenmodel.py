#!/usr/bin/env python3
"""Build viewer data for the 10-model universal taxonomy.

Same method as precompute_recommended.py (the shipped 6-model "dedup" pipeline) but for the
10-model run: the 6 recommended_decoding models (latents reused verbatim) + 4 newer local
models (gemma / glm / ministral / qwen3.6). Emits into a distinct pipeline id so the viewer's
top-bar toggle can switch 6-model <-> 10-model.

Outputs:
    public/data/pipelines/tenmodel/cases/{model}.json
    public/data/pipelines/tenmodel/points/{model}.json
    public/data/pipelines/tenmodel/taxonomy.json

Inputs come from the 10-model run under universal-taxonomy/results/:
  - plain/latent_cache/{model}.npz : per-sentence pmcid, sent_idx, text, S256
  - plain/labels/{model}.npy       : per-sentence final taxonomy category (0..K-1)
  - plain/taxonomy.json            : K category names/descriptions
  - plain/winner.json              : winning (layer, sae_k) per model (the left-panel projection SAE)
  - responses_{model}.json         : per-case prompt/gold/full_response (generate-responses/results/vars)
  - responses_{model}.graded.json  : LLM grade (extracted_answer / is_correct), keyed by pmcid

2-D projection = PCA→50 + t-SNE on L Lᵀ S (the sentence through its winning SAE's latents),
coloured by taxonomy category. No model is loaded.

Usage: python scripts/precompute_tenmodel.py [--model M] [--tsne-max 20000]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

WT = Path("/home/ttn/Development/med-interp/thinking-llms-interp")
_RUN = WT / "universal-taxonomy" / "results"
CACHE_DIR = _RUN / "plain" / "latent_cache"
LABELS_DIR = _RUN / "plain" / "labels"
TAX_JSON = _RUN / "plain" / "taxonomy.json"
WINNER_JSON = _RUN / "plain" / "winner.json"
RESP_DIR = WT / "generate-responses" / "results" / "vars"

# Per-model sidecar latents for the L Lᵀ S projection. The 6 recommended models reuse the
# shipped recommended-decoding latents (matching their reused latent_cache); the 4 new models
# use the local run's latents under results/vars.
_REC_SIDECAR = WT / "universal-taxonomy" / "results_recommended" / "vars" / "latents"
_RUN_SIDECAR = _RUN / "vars" / "latents"
RECOMMENDED_6 = {
    "deepseek-r1-distill-llama-8b", "deepseek-r1-distill-qwen-1.5b",
    "deepseek-r1-distill-qwen-14b", "gpt-oss-20b", "huatuogpt-o1-8b", "qwq-32b",
}

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "public" / "data" / "pipelines" / "tenmodel"
PIPELINE_ID = "tenmodel"

# (dataset_name, dataset_split) -> viewer dataset id (matches metadata.json datasets).
DATASET_MAP = {
    ("tmknguyen/MedCaseReasoning-filtered", "nejm"): "nejm-cpc",
    ("tmknguyen/MedCaseReasoning-filtered", "medqa"): "medqa",
    ("matthewshu/medmcqa-filtered", "train"): "medmcqa-filtered",
}
EXAMPLES_PER_CATEGORY = 100
EXAMPLES_SEED = 42

PALETTE = [
    "#9467bd", "#ff7f0e", "#1f77b4", "#e377c2", "#2ca02c", "#d62728",
    "#8c564b", "#17becf", "#bcbd22", "#7f7f7f", "#5b8def", "#e7969c",
]

_ANSWER_RE = re.compile(r"<answer>(.*?)</answer>", re.S)
_NORM_RE = re.compile(r"[^a-z0-9 ]+")


def _sidecar_dir(model: str) -> Path:
    return (_REC_SIDECAR if model in RECOMMENDED_6 else _RUN_SIDECAR) / model


def _dataset_of(r: dict) -> str:
    return DATASET_MAP.get((r.get("dataset_name"), r.get("dataset_split")), "medqa")


def _short_name(label: str) -> str:
    s = label.split("(", 1)[0].split(",", 1)[0].split(":", 1)[0].strip()
    return (s[:27].rstrip(" -/") + "…") if len(s) > 28 else (s or label)


def parse_pred(full_response: str) -> str:
    matches = _ANSWER_RE.findall(full_response or "")
    for cand in reversed(matches):
        c = cand.strip()
        if c and "the name of the disease" not in c and c != "...":
            return c
    return ""


def _clean_dx(s: str) -> str:
    s = (s or "").replace("**", "").strip()
    s = re.sub(r"^(the\s+)?most likely diagnosis is[:\s]*", "", s, flags=re.I).strip()
    return s.rstrip(".").strip() or s


def load_grading(model: str) -> dict[str, dict]:
    """pmcid -> {true, pred, correct} from the local graded responses (LLM semantic grade)."""
    path = RESP_DIR / f"responses_{model}.graded.json"
    if not path.exists():
        return {}
    out: dict[str, dict] = {}
    for r in json.load(open(path)):
        if not r:
            continue
        out[r["pmcid"]] = {
            "true": r.get("gold_answer", "") or "",
            "pred": _clean_dx(r.get("extracted_answer", "")),
            "correct": bool(r.get("is_correct", False)),
        }
    return out


def latent_reconstructed_embedding(model: str, sel: tuple[int, int], pmcids: list[str],
                                   sent_idx: np.ndarray, S: np.ndarray) -> np.ndarray:
    """vecs = Vn (Vnᵀ S) = L Lᵀ S for the model's winning SAE, aligned to the cache rows."""
    layer, k = sel
    base = _sidecar_dir(model) / f"layer{layer}"
    L_side = np.load(base / "latents.npz")[f"k{k}"].astype(np.float32)   # (N_side, k)
    idx = np.load(base / "index.npz", allow_pickle=True)
    side_pm = [p.decode() if isinstance(p, bytes) else str(p) for p in idx["pmcid"]]
    side_si = idx["sentence_idx"].astype(int)
    row_of = {(pm, int(si)): r for r, (pm, si) in enumerate(zip(side_pm, side_si))}

    L = np.empty((len(pmcids), k), dtype=np.float32)
    miss = 0
    for i, (pm, si) in enumerate(zip(pmcids, sent_idx)):
        r = row_of.get((pm, int(si)))
        if r is None:
            L[i] = 0.0
            miss += 1
        else:
            L[i] = L_side[r]
    if miss:
        print(f"  [warn] {miss}/{len(pmcids)} sentences missing from sidecar (zero-filled)")

    Vn = L - L.mean(0, keepdims=True)
    Vn = Vn / (np.linalg.norm(Vn) + 1e-8)                 # Frobenius (matches cache_latents)
    E = Vn.T @ S                                          # (k, 256)
    return (Vn @ E).astype(np.float32)                    # (N, 256) = L Lᵀ S


def project_2d(features: np.ndarray, max_points: int, seed: int = 42) -> np.ndarray:
    from sklearn.decomposition import PCA
    from sklearn.manifold import TSNE
    from sklearn.neighbors import NearestNeighbors

    n = features.shape[0]
    x = PCA(n_components=50, random_state=seed).fit_transform(features) if features.shape[1] > 50 else features
    if n > max_points:
        rng = np.random.default_rng(seed)
        sample = np.sort(rng.choice(n, max_points, replace=False))
        emb_s = TSNE(n_components=2, init="pca", random_state=seed, perplexity=30).fit_transform(x[sample])
        nn = NearestNeighbors(n_neighbors=1).fit(x[sample])
        idx = nn.kneighbors(x, return_distance=False)[:, 0]
        emb = emb_s[idx]
    else:
        emb = TSNE(n_components=2, init="pca", random_state=seed, perplexity=30).fit_transform(x)
    return emb.astype(np.float32)


def emit_model(model: str, sel: tuple[int, int], tsne_max: int,
               category_sentences: dict[int, list]) -> None:
    cache = np.load(CACHE_DIR / f"{model}.npz", allow_pickle=True)
    pmcids = [str(p) for p in cache["pmcid"]]
    sent_idx = cache["sent_idx"].astype(int)
    texts = [str(t) for t in cache["text"]]
    S = cache["S256"].astype(np.float32)
    cats = np.load(LABELS_DIR / f"{model}.npy").astype(int)
    assert len(pmcids) == len(cats) == S.shape[0], f"{model}: misaligned cache/labels"

    resp = {r["pmcid"]: r for r in json.load(open(RESP_DIR / f"responses_{model}.json"))}
    grading = load_grading(model)  # pmcid -> {true, pred, correct}

    vecs = latent_reconstructed_embedding(model, sel, pmcids, sent_idx, S)
    print(f"  projecting {vecs.shape[0]} × {vecs.shape[1]} (L Lᵀ S) → 2D", flush=True)
    coords = project_2d(vecs, tsne_max)

    order: list[str] = []
    rows_by_case: dict[str, list[int]] = defaultdict(list)
    for row, pm in enumerate(pmcids):
        if pm not in rows_by_case:
            order.append(pm)
        rows_by_case[pm].append(row)

    cases: list[dict] = []
    points: list[list[float | int]] = []
    for case_idx, pm in enumerate(order):
        rows = sorted(rows_by_case[pm], key=lambda r: sent_idx[r])
        r = resp.get(pm, {})
        g = grading.get(pm)
        true = (g["true"] if g else r.get("gold_answer", "")) or ""
        pred = g["pred"] if g else parse_pred(r.get("full_response", ""))
        correct = bool(g["correct"]) if g else False
        ds = _dataset_of(r)
        sentences = []
        for pos, row in enumerate(rows):
            x, y = coords[row]
            cat = int(cats[row])
            sentences.append({
                "s": texts[row], "t": cat, "c": None,
                "i": pos + 1, "x": round(float(x), 2), "y": round(float(y), 2),
            })
            category_sentences[cat].append((texts[row], model, int(case_idx), int(pos), ds, true))
            points.append([round(float(x), 2), round(float(y), 2),
                           cat, 0, int(case_idx), int(pos)])
        cases.append({
            "id": f"{model}::{pm}",
            "qid": r.get("question_id"),
            "prompt": r.get("question", "") or "",
            "dataset": ds,
            "true_dx": true,
            "pred_dx": pred,
            "correct": correct,
            "sentences": sentences,
        })

    (OUT_DIR / "cases").mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "points").mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "cases" / f"{model}.json").write_text(
        json.dumps(cases, ensure_ascii=False, separators=(",", ":")))
    (OUT_DIR / "points" / f"{model}.json").write_text(
        json.dumps(points, separators=(",", ":")))
    n_correct = sum(c["correct"] for c in cases)
    print(f"  wrote {len(cases)} cases ({n_correct} correct), {len(points)} points", flush=True)


def write_taxonomy(state_names: list[str], descriptions: list[str],
                   examples: dict[int, list], models: list[str]) -> None:
    states = [{"label": s, "short_name": _short_name(s), "description": descriptions[i],
               "color": PALETTE[i % len(PALETTE)], "examples": examples.get(i, [])}
              for i, s in enumerate(state_names)]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "taxonomy.json").write_text(json.dumps(
        {"pipeline": PIPELINE_ID, "states": states, "has_dataset": False, "models": models},
        ensure_ascii=False, indent=2))
    n_ex = sum(len(e) for e in examples.values())
    print(f"wrote taxonomy.json with {len(states)} states, {n_ex} example sentences")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model")
    ap.add_argument("--tsne-max", type=int, default=20000)
    args = ap.parse_args(argv)

    winner = json.load(open(WINNER_JSON))
    sel_all = {m: tuple(v) for m, v in winner["sel"].items()}
    models = list(sel_all.keys())

    tax = json.load(open(TAX_JSON))["states"]
    state_names = [s["label"] for s in tax]
    descriptions = [s.get("description", "") for s in tax]

    category_sentences: dict[int, list] = defaultdict(list)
    targets = [args.model] if args.model else models
    for m in targets:
        print(f"[{m}] sel={sel_all[m]}", flush=True)
        emit_model(m, sel_all[m], args.tsne_max, category_sentences)

    rng = np.random.default_rng(EXAMPLES_SEED)
    examples: dict[int, list[dict]] = {}
    for c, items in category_sentences.items():
        by_text: dict[str, tuple] = {}
        for (t, m, ci, pos, ds, dx) in items:
            by_text.setdefault(t, (m, ci, pos, ds, dx))
        keys = sorted(by_text)
        pick = sorted(rng.permutation(len(keys))[:EXAMPLES_PER_CATEGORY].tolist())
        examples[c] = [{"s": keys[i], "model": by_text[keys[i]][0],
                        "caseIdx": by_text[keys[i]][1], "sentIdx": by_text[keys[i]][2],
                        "dataset": by_text[keys[i]][3], "dx": by_text[keys[i]][4]}
                       for i in pick]
    write_taxonomy(state_names, descriptions, examples, models)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
