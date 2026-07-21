#!/usr/bin/env python3
"""Pre-render the Plots tab: chord diagrams, Sankey diagrams and transition matrices.

Chords and Sankeys are both built with Plotly (Python-only) and rendered here to static SVG
at build time rather than shipped as a client bundle. Plotly has no chord trace, so the
chord is composed from arcs and Bezier ribbons. Transition matrices are emitted as JSON
instead, because the page draws them itself as a small, crisp grid.

For each pipeline (dedup = 6 models, tenmodel = 10) and each subset
(all / correct / incorrect traces) we produce:
  * one "All models" figure over the pooled traces
  * one figure per model

A transition is P(next state = j | current state = i), counted over consecutive sentence
pairs within a trace and row-normalised. Self-transitions are included in the row totals
(a state usually follows itself) but are dropped from the chord and Sankey, which show
*movement* between states. Anything below MIN_P is omitted so the figures stay legible.

Output (all under public/data/plots/):
  <pipeline>.json                     matrices + metadata for every subset and model
  <pipeline>/chord_<subset>_<key>.svg
  <pipeline>/sankey_<subset>_<key>.svg

Usage: python scripts/generate_plots.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import plotly.graph_objects as go

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data" / "pipelines"
OUT = ROOT / "public" / "data" / "plots"

PIPELINES = ["dedup", "tenmodel"]
SUBSETS = ["all", "correct", "incorrect"]
MIN_P = 0.1          # transitions below this are hidden (stated in the UI)
OVERALL = "__all__"  # key for the pooled "All models" figure


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
    """Raw K×K counts of consecutive (state -> next state) pairs, plus trace count."""
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
        P = np.where(rows > 0, M / rows, 0.0)
    return P


def _empty_svg(dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        '<text x="50" y="50" text-anchor="middle" font-size="6" fill="#94a3b8">'
        "no transition &#8805; 0.1</text></svg>"
    )


def _arc(a0: float, a1: float, r: float, n: int = 48):
    t = np.linspace(a0, a1, n)
    return r * np.cos(t), r * np.sin(t)


def _bezier(p0, p1, n: int = 40):
    """Quadratic Bézier from p0 to p1 bending through the centre — the chord ribbon spine."""
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, c = np.array(p0), np.array(p1), np.array([0.0, 0.0])
    pts = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t**2 * p1
    return pts[:, 0], pts[:, 1]


def chord_svg(P: np.ndarray, states, colors, dest: Path) -> None:
    """Chord diagram, drawn in Plotly (no native chord trace, so arcs + Bézier ribbons).

    Sector width is proportional to the state's total shown flow (outgoing + incoming).
    Self-transitions and links below MIN_P are dropped, so the figure shows *movement*.
    """
    K = len(states)
    shown = np.zeros((K, K))
    for i in range(K):
        for j in range(K):
            if i != j and P[i, j] >= MIN_P:
                shown[i, j] = P[i, j]
    if not shown.any():
        _empty_svg(dest)
        return

    used = [i for i in range(K) if shown[i].sum() + shown[:, i].sum() > 0]
    total = {i: shown[i].sum() + shown[:, i].sum() for i in used}
    grand = sum(total.values())

    GAP = np.deg2rad(6)
    avail = 2 * np.pi - GAP * len(used)
    R, RIB = 1.0, 0.93

    # Lay out each sector, then carve it into one slot per link endpoint.
    start, spans, slots = 0.0, {}, {}
    for i in used:
        span = avail * total[i] / grand
        spans[i] = (start, start + span)
        cur = start
        for j in used:                                  # outgoing slots first
            if shown[i, j] > 0:
                w = span * shown[i, j] / total[i]
                slots[("out", i, j)] = (cur, cur + w)
                cur += w
        for j in used:                                  # then incoming
            if shown[j, i] > 0:
                w = span * shown[j, i] / total[i]
                slots[("in", i, j)] = (cur, cur + w)
                cur += w
        start += span + GAP

    fig = go.Figure()

    # Ribbons, widest first so small ones stay visible on top.
    for i, j in sorted(
        [(i, j) for i in used for j in used if shown[i, j] > 0],
        key=lambda ij: -shown[ij[0], ij[1]],
    ):
        s0, s1 = slots[("out", i, j)]
        t0, t1 = slots[("in", j, i)]
        sx, sy = _arc(s0, s1, RIB)
        tx, ty = _arc(t0, t1, RIB)
        b1x, b1y = _bezier((sx[-1], sy[-1]), (tx[0], ty[0]))
        b2x, b2y = _bezier((tx[-1], ty[-1]), (sx[0], sy[0]))
        fig.add_trace(
            go.Scatter(
                x=np.concatenate([sx, b1x, tx, b2x]),
                y=np.concatenate([sy, b1y, ty, b2y]),
                fill="toself",
                fillcolor=_hex_to_rgba(colors[i], 0.45),
                line=dict(color=_hex_to_rgba(colors[i], 0.55), width=0.5),
                mode="lines",
                hoverinfo="text",
                text=f"{states[i]} → {states[j]}: {shown[i, j]:.2f}",
                showlegend=False,
            )
        )

    # Sector arcs + labels.
    for i in used:
        a0, a1 = spans[i]
        ax, ay = _arc(a0, a1, R)
        fig.add_trace(
            go.Scatter(
                x=ax, y=ay, mode="lines",
                line=dict(color=colors[i], width=9),
                hoverinfo="text", text=states[i], showlegend=False,
            )
        )
        mid = (a0 + a1) / 2
        fig.add_annotation(
            x=1.13 * np.cos(mid), y=1.13 * np.sin(mid),
            text=states[i], showarrow=False,
            font=dict(size=11, color="#334155"),
            xanchor="center", yanchor="middle",
        )

    fig.update_xaxes(visible=False, range=[-1.55, 1.55], scaleanchor="y", scaleratio=1)
    fig.update_yaxes(visible=False, range=[-1.35, 1.35])
    fig.update_layout(
        width=640, height=560,
        margin=dict(l=4, r=4, t=4, b=4),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        hovermode="closest",
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    fig.write_image(dest, format="svg")


def _hex_to_rgba(h: str, a: float) -> str:
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return f"rgba({r},{g},{b},{a})"


def sankey_svg(P: np.ndarray, states, colors, dest: Path) -> None:
    """One-step Sankey: state (left) -> next state (right), links < MIN_P dropped."""
    K = len(states)
    src, tgt, val, lc = [], [], [], []
    for i in range(K):
        for j in range(K):
            if i != j and P[i, j] >= MIN_P:
                src.append(i)
                tgt.append(K + j)
                val.append(float(P[i, j]))
                lc.append(_hex_to_rgba(colors[i], 0.45))
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not val:
        dest.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            '<text x="50" y="50" text-anchor="middle" font-size="6" fill="#94a3b8">'
            "no transition &#8805; 0.1</text></svg>"
        )
        return

    fig = go.Figure(
        go.Sankey(
            arrangement="snap",
            node=dict(
                label=states + states,
                color=colors + colors,
                pad=14,
                thickness=12,
                line=dict(width=0),
            ),
            link=dict(source=src, target=tgt, value=val, color=lc),
        )
    )
    fig.update_layout(
        font=dict(size=11),
        margin=dict(l=4, r=4, t=4, b=4),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        width=760,
        height=460,
    )
    fig.write_image(dest, format="svg")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for pipeline in PIPELINES:
        states, colors, models, cases = load_pipeline(pipeline)
        K = len(states)
        payload = {
            "pipeline": pipeline,
            "states": states,
            "colors": colors,
            "models": models,
            "minP": MIN_P,
            "subsets": {},
        }

        for subset in SUBSETS:
            per_model, pooled = {}, np.zeros((K, K), dtype=np.int64)
            traces = {}
            for m in models:
                M, n = transition_counts(cases.get(m, []), K, subset)
                per_model[m] = M
                traces[m] = n
                pooled += M

            entry = {
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
            payload["subsets"][subset] = entry

            figs = [(OVERALL, row_normalise(pooled))] + [
                (m, row_normalise(per_model[m])) for m in models
            ]
            for key, P in figs:
                stem = f"{subset}_{key}"
                chord_svg(P, states, colors, OUT / pipeline / f"chord_{stem}.svg")
                sankey_svg(P, states, colors, OUT / pipeline / f"sankey_{stem}.svg")
            print(f"  {pipeline}/{subset}: {len(figs)} chord + {len(figs)} sankey", flush=True)

        (OUT / f"{pipeline}.json").write_text(json.dumps(payload))
        print(f"{pipeline}: wrote {OUT / (pipeline + '.json')}", flush=True)


if __name__ == "__main__":
    main()
