#!/usr/bin/env python3
"""Pre-render the Plots tab's chord diagrams and emit its transition data.

Chords come from pyCirclize, which is Python-only, so they are rendered here to static SVG
at build time. Sankeys are *not* pre-rendered: they need hover highlighting and a tooltip,
so the page draws them client-side with Plotly from the link data emitted here. Transition
matrices are likewise drawn by the page.

Everything is computed over **all traces**, except the correct/incorrect matrices, which the
page differences into a single correct − incorrect view.

A transition is P(next state = j | current state = i), counted over consecutive sentence
pairs within a trace and row-normalised.

* matrices  complete — every cell, including values below MIN_P
* chord     between-state movement only: self-transitions and links < MIN_P are dropped,
            otherwise the figure is an unreadable hairball
* sankey    same thresholding as the chord, emitted as link data for the client

Output (all under public/data/plots/):
  <pipeline>.json                  states, colours, matrices (all/correct/incorrect), links
  <pipeline>/chord_<key>.svg       key = __all__ (pooled) or a model slug

Usage: python scripts/generate_plots.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from pycirclize import Circos

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data" / "pipelines"
OUT = ROOT / "public" / "data" / "plots"

# The page renders in Tailwind's preflight stack, so the SVGs declare the same one and the
# browser resolves it exactly as it does for the rest of the site. Matplotlib still lays the
# text out in its default DejaVu Sans, which is a little wider than what the browser will
# actually use — that errs on the side of a slightly roomy label plate rather than one the
# text overflows.
SITE_FONT = "ui-sans-serif, system-ui, sans-serif"

PIPELINES = ["dedup", "tenmodel"]
MIN_P = 0.1          # chord/Sankey legibility threshold; matrices are complete
OVERALL = "__all__"


def load_pipeline(pipeline: str):
    tax = json.loads((DATA / pipeline / "taxonomy.json").read_text())
    states = [s["label"] for s in tax["states"]]
    colors = [s["color"] for s in tax["states"]]
    models = tax.get("models", [])
    cases = {}
    for m in models:
        p = DATA / pipeline / "cases" / f"{m}.json"
        if p.exists():
            cases[m] = json.loads(p.read_text())
    return states, colors, models, cases


def transition_counts(cases: list, K: int, subset: str) -> tuple[np.ndarray, int]:
    M = np.zeros((K, K), dtype=np.int64)
    n_traces = 0
    for c in cases:
        if subset == "correct" and not c.get("correct"):
            continue
        if subset == "incorrect" and c.get("correct"):
            continue
        seq = [s["t"] for s in c.get("sentences", [])
               if isinstance(s.get("t"), int) and 0 <= s["t"] < K]
        if len(seq) < 2:
            continue
        n_traces += 1
        for a, b in zip(seq, seq[1:]):
            M[a, b] += 1
    return M, n_traces


def row_normalise(M: np.ndarray) -> np.ndarray:
    rows = M.sum(axis=1, keepdims=True)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(rows > 0, M / rows, 0.0)


def chord_svg(P: np.ndarray, states, colors, dest: Path) -> None:
    """pyCirclize chord of between-state movement (self-transitions and < MIN_P dropped)."""
    K = len(states)
    shown = np.zeros((K, K))
    for i in range(K):
        for j in range(K):
            if i != j and P[i, j] >= MIN_P:
                shown[i, j] = P[i, j]

    dest.parent.mkdir(parents=True, exist_ok=True)
    if not shown.any():
        dest.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            '<text x="50" y="50" text-anchor="middle" font-size="6" fill="#94a3b8">'
            "no transition &#8805; 0.1</text></svg>"
        )
        return

    used = sorted({i for i in range(K) if shown[i].sum() + shown[:, i].sum() > 0})
    labels = [states[i] for i in used]
    # A labelled frame keeps pyCirclize's sector names and colours aligned; a bare ndarray
    # would leave it to invent names.
    sub = pd.DataFrame(shown[np.ix_(used, used)], index=labels, columns=labels)

    circos = Circos.chord_diagram(
        sub,
        space=4,
        cmap={lab: colors[i] for lab, i in zip(labels, used)},
        # Built-in sector labels follow the arc. Suppress them and place our own with
        # Circos.text(adjust_rotation=False), which is the only way to get text that stays
        # horizontal on screen regardless of where the sector sits on the circle.
        label_kws=dict(size=0, alpha=0),
        link_kws=dict(direction=1, ec="white", lw=0.2, alpha=0.72),
    )
    for sector in circos.sectors:
        lo, hi = sector.deg_lim
        # A 0.9-opacity white plate behind each label: the ribbons reach close to the ring,
        # so horizontal text at a fixed radius otherwise overlaps them.
        circos.text(
            sector.name, r=118, deg=(lo + hi) / 2,
            adjust_rotation=False, size=9, color="#334155",
            bbox=dict(boxstyle="round,pad=0.28", facecolor="white",
                      edgecolor="none", alpha=0.9),
        )
    fig = circos.plotfig(dpi=100, figsize=(6, 6))
    fig.savefig(dest, format="svg", bbox_inches="tight", transparent=True)
    import matplotlib.pyplot as plt
    plt.close(fig)
    dest.write_text(
        dest.read_text().replace("font-family: 'DejaVu Sans'", f"font-family: {SITE_FONT}")
    )


def links(P: np.ndarray, K: int):
    """Sankey link data for the client: current state -> next state, < MIN_P dropped."""
    out = []
    for i in range(K):
        for j in range(K):
            if i != j and P[i, j] >= MIN_P:
                out.append({"s": i, "t": j, "v": round(float(P[i, j]), 4)})
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for pipeline in PIPELINES:
        states, colors, models, cases = load_pipeline(pipeline)
        K = len(states)

        subsets = {}
        for subset in ("all", "correct", "incorrect"):
            per_model, pooled, traces = {}, np.zeros((K, K), dtype=np.int64), {}
            for m in models:
                M, n = transition_counts(cases.get(m, []), K, subset)
                per_model[m], traces[m] = M, n
                pooled += M
            subsets[subset] = {
                "overall": {
                    "matrix": row_normalise(pooled).round(4).tolist(),
                    "traces": int(sum(traces.values())),
                    "transitions": int(pooled.sum()),
                },
                "byModel": {
                    m: {
                        "matrix": row_normalise(per_model[m]).round(4).tolist(),
                        "traces": traces[m],
                        "transitions": int(per_model[m].sum()),
                    }
                    for m in models
                },
            }

        # Sankey links + chords use the all-traces matrices.
        all_sub = subsets["all"]
        sankey = {OVERALL: links(np.array(all_sub["overall"]["matrix"]), K)}
        for m in models:
            sankey[m] = links(np.array(all_sub["byModel"][m]["matrix"]), K)

        payload = {
            "pipeline": pipeline,
            "states": states,
            "colors": colors,
            "models": models,
            "minP": MIN_P,
            "subsets": subsets,
            "sankey": sankey,
        }
        (OUT / f"{pipeline}.json").write_text(json.dumps(payload))

        chord_svg(np.array(all_sub["overall"]["matrix"]), states, colors,
                  OUT / pipeline / f"chord_{OVERALL}.svg")
        for m in models:
            chord_svg(np.array(all_sub["byModel"][m]["matrix"]), states, colors,
                      OUT / pipeline / f"chord_{m}.svg")
        print(f"{pipeline}: {1 + len(models)} chords + {OUT / (pipeline + '.json')}", flush=True)


if __name__ == "__main__":
    main()
