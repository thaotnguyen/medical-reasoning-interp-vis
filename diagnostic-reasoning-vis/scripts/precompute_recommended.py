#!/usr/bin/env python3
"""Build viewer data for the recommended_decoding universal taxonomy (6 models).

For each model, emit into the "dedup" pipeline (the single "Latent embedding" view):
    public/data/pipelines/dedup/cases/{model}.json
    public/data/pipelines/dedup/points/{model}.json
    public/data/pipelines/dedup/taxonomy.json   (once)

Inputs come from the recommended-decoding run in the rec-decoding worktree:
  - latent_cache/{model}.npz : per-sentence pmcid, sent_idx, text, S256 (OpenAI sentence emb)
  - labels/{model}.npy       : per-sentence final taxonomy category (0..K-1), aligned to the cache
  - responses_{model}.json   : per-case prompt (question), gold_answer, full_response
  - taxonomy.json            : the K category names

2-D projection = PCA→50 + t-SNE on the S256 sentence embeddings (subsampled, 1-NN extended),
coloured by the taxonomy category. No model is loaded.

Usage: python scripts/precompute_recommended.py [--model M] [--tsne-max 20000]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

HF_REPO = "matthewshu/medcasereasoning-cot-activations"
# The rec worktree was consolidated into the main repo: rec taxonomy now lives under
# universal-taxonomy/results_recommended/ and rec_data/ at the main repo root.
WT = Path("/home/ttn/Development/med-interp/thinking-llms-interp")
_REC = WT / "universal-taxonomy" / "results_recommended"
CACHE_DIR = _REC / "plain" / "latent_cache"
LABELS_DIR = _REC / "plain" / "labels"
TAX_JSON = _REC / "plain" / "taxonomy.json"
RESP_DIR = WT / "rec_data" / "snapshot" / "responses"

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = REPO_ROOT / "public" / "data" / "pipelines" / "dedup"

MODELS = [
    "deepseek-r1-distill-llama-8b",
    "deepseek-r1-distill-qwen-1.5b",
    "deepseek-r1-distill-qwen-14b",
    "gpt-oss-20b",
    "huatuogpt-o1-8b",
    "qwq-32b",
]

# Winning (layer, sae_k) per model from the taxonomy search (results/plain/winner.json).
# The left-panel projection is the taxonomy's own geometry: each sentence embedded through this
# SAE's latents, i.e. vecs = Vn (Vnᵀ S) = L Lᵀ S with Vn = per-block centred + Frobenius-normalised
# latents (matching cache_latents), S = the sentence embedding.
WINNING_SEL = {
    "deepseek-r1-distill-llama-8b": (14, 18),
    "deepseek-r1-distill-qwen-1.5b": (8, 14),
    "deepseek-r1-distill-qwen-14b": (26, 14),
    "gpt-oss-20b": (17, 16),
    "huatuogpt-o1-8b": (10, 14),
    "qwq-32b": (45, 16),
}
SIDECAR_DIR = _REC / "vars" / "latents"

# (dataset_name, dataset_split) -> viewer dataset id (matches metadata.json datasets).
DATASET_MAP = {
    ("tmknguyen/MedCaseReasoning-filtered", "nejm"): "nejm-cpc",
    ("tmknguyen/MedCaseReasoning-filtered", "medqa"): "medqa",
    ("matthewshu/medmcqa-filtered", "train"): "medmcqa-filtered",
}
EXAMPLES_PER_CATEGORY = 100
EXAMPLES_SEED = 42


def _dataset_of(r: dict) -> str:
    return DATASET_MAP.get((r.get("dataset_name"), r.get("dataset_split")), "medqa")

PALETTE = [
    "#9467bd", "#ff7f0e", "#1f77b4", "#e377c2", "#2ca02c", "#d62728",
    "#8c564b", "#17becf", "#bcbd22", "#7f7f7f", "#5b8def", "#e7969c",
]

_ANSWER_RE = re.compile(r"<answer>(.*?)</answer>", re.S)
_NORM_RE = re.compile(r"[^a-z0-9 ]+")


def _short_name(label: str) -> str:
    s = label.split("(", 1)[0].split(",", 1)[0].split(":", 1)[0].strip()
    return (s[:27].rstrip(" -/") + "…") if len(s) > 28 else (s or label)


def _norm_dx(s: str) -> str:
    return _NORM_RE.sub("", (s or "").lower()).strip()


def parse_pred(full_response: str) -> str:
    """The real diagnosis is the LAST <answer> block (earlier ones echo the prompt template)."""
    matches = _ANSWER_RE.findall(full_response or "")
    for cand in reversed(matches):
        c = cand.strip()
        if c and "the name of the disease" not in c and c != "...":
            return c
    return ""


def _clean_dx(s: str) -> str:
    """Tidy the graded extracted_answer for display (drop markdown / boilerplate)."""
    s = (s or "").replace("**", "").strip()
    s = re.sub(r"^(the\s+)?most likely diagnosis is[:\s]*", "", s, flags=re.I).strip()
    return s.rstrip(".").strip() or s


def load_grading(model: str) -> dict[str, dict]:
    """pmcid -> {true, pred, correct} from the HF temp0 graded responses (semantic LLM grade).

    recommended_decoding responses ship ungraded; the graded set (extracted_answer / is_correct /
    gold_answer, keyed by pmcid) lives under temp0_greedy_decoding on the same HF dataset.
    """
    from huggingface_hub import hf_hub_download
    path = hf_hub_download(
        HF_REPO, repo_type="dataset",
        filename=f"temp0_greedy_decoding/responses/responses_{model}.graded.json")
    out: dict[str, dict] = {}
    for r in json.load(open(path)):
        out[r["pmcid"]] = {
            "true": r.get("gold_answer", "") or "",
            "pred": _clean_dx(r.get("extracted_answer", "")),
            "correct": bool(r.get("is_correct", False)),
        }
    return out


def latent_reconstructed_embedding(model: str, pmcids: list[str], sent_idx: np.ndarray,
                                   S: np.ndarray) -> np.ndarray:
    """vecs = Vn (Vnᵀ S) for the model's winning SAE, aligned to the cache rows.

    Vn = per-block centred + Frobenius-normalised per-sentence latents (as in cache_latents),
    so this is the exact space the taxonomy search/labels live in — 'the sentence as the SAE
    sees it' = L Lᵀ S.
    """
    layer, k = WINNING_SEL[model]
    base = SIDECAR_DIR / model / f"layer{layer}"
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


def emit_model(model: str, tsne_max: int, category_sentences: dict[int, list[str]]) -> None:
    cache = np.load(CACHE_DIR / f"{model}.npz", allow_pickle=True)
    pmcids = [str(p) for p in cache["pmcid"]]
    sent_idx = cache["sent_idx"].astype(int)
    texts = [str(t) for t in cache["text"]]
    S = cache["S256"].astype(np.float32)
    cats = np.load(LABELS_DIR / f"{model}.npy").astype(int)
    assert len(pmcids) == len(cats) == S.shape[0], f"{model}: misaligned cache/labels"

    resp = {r["pmcid"]: r for r in json.load(open(RESP_DIR / f"responses_{model}.json"))}
    grading = load_grading(model)  # pmcid -> {true, pred, correct}

    vecs = latent_reconstructed_embedding(model, pmcids, sent_idx, S)
    print(f"  projecting {vecs.shape[0]} × {vecs.shape[1]} (L Lᵀ S) → 2D", flush=True)
    coords = project_2d(vecs, tsne_max)

    # group sentence rows by case in first-appearance order
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
        sentences = []
        for pos, row in enumerate(rows):
            x, y = coords[row]
            cat = int(cats[row])
            sentences.append({
                "s": texts[row], "t": cat, "c": None,
                "i": pos + 1, "x": round(float(x), 2), "y": round(float(y), 2),
            })
            category_sentences[cat].append((texts[row], model, int(case_idx), int(pos)))
            # point cols: x, y, taxonomy, cluster, caseIdx, sentenceArrayPos (0-based)
            points.append([round(float(x), 2), round(float(y), 2),
                           cat, 0, int(case_idx), int(pos)])
        cases.append({
            "id": f"{model}::{pm}",
            "qid": r.get("question_id"),
            "prompt": r.get("question", "") or "",
            "dataset": _dataset_of(r),
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
                   examples: dict[int, list[str]], models: list[str]) -> None:
    states = [{"label": s, "short_name": _short_name(s), "description": descriptions[i],
               "color": PALETTE[i % len(PALETTE)], "examples": examples.get(i, [])}
              for i, s in enumerate(state_names)]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "taxonomy.json").write_text(json.dumps(
        {"pipeline": "dedup", "states": states, "has_dataset": False, "models": models},
        ensure_ascii=False, indent=2))
    n_ex = sum(len(e) for e in examples.values())
    print(f"wrote taxonomy.json with {len(states)} states, {n_ex} example sentences")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model")
    ap.add_argument("--tsne-max", type=int, default=20000)
    args = ap.parse_args(argv)

    tax = json.load(open(TAX_JSON))["states"]
    state_names = [s["label"] for s in tax]
    descriptions = [s.get("description", "") for s in tax]

    category_sentences: dict[int, list[str]] = defaultdict(list)
    targets = [args.model] if args.model else MODELS
    for m in targets:
        print(f"[{m}]", flush=True)
        emit_model(m, args.tsne_max, category_sentences)

    # 100 example sentences per category, seeded so they never drift between runs. Each keeps
    # its source (model, caseIdx, sentIdx) so the browser can jump to it in the Explorer.
    rng = np.random.default_rng(EXAMPLES_SEED)
    examples: dict[int, list[dict]] = {}
    for c, items in category_sentences.items():
        by_text: dict[str, tuple] = {}
        for (t, m, ci, pos) in items:
            by_text.setdefault(t, (m, ci, pos))
        keys = sorted(by_text)
        pick = sorted(rng.permutation(len(keys))[:EXAMPLES_PER_CATEGORY].tolist())
        examples[c] = [{"s": keys[i], "model": by_text[keys[i]][0],
                        "caseIdx": by_text[keys[i]][1], "sentIdx": by_text[keys[i]][2]}
                       for i in pick]
    write_taxonomy(state_names, descriptions, examples, MODELS)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
