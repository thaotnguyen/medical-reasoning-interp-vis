"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useMetadata } from "@/hooks/useMetadata";
import { useAppState } from "@/hooks/useAppState";
import { Skeleton } from "@/components/ui/skeleton";
import { TransitionMatrix } from "./TransitionMatrix";
import { SankeyPlot, type SankeyLink } from "./SankeyPlot";

type Entry = { matrix: number[][]; traces: number; transitions: number };
type Subset = { overall: Entry; byModel: Record<string, Entry> };
interface PlotsData {
  pipeline: string;
  states: string[];
  colors: string[];
  models: string[];
  minP: number;
  subsets: Record<"all" | "correct" | "incorrect", Subset>;
  sankey: Record<string, SankeyLink[]>;
}

const OVERALL = "__all__";

/** correct − incorrect, cell by cell. */
function diff(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((v, j) => +(v - (b[i]?.[j] ?? 0)).toFixed(4)));
}

export function PlotsPanel() {
  const { metadata } = useMetadata();
  const { selectedPipeline } = useAppState();
  const [data, setData] = useState<PlotsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<{
    src?: string;
    node?: React.ReactNode;
    title: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/data/plots/${selectedPipeline}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedPipeline]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  // Shared scale for every difference matrix, so models stay comparable to each other.
  const diffScale = useMemo(() => {
    if (!data) return 0.1;
    const { correct, incorrect } = data.subsets;
    const all = [
      diff(correct.overall.matrix, incorrect.overall.matrix),
      ...data.models.map((m) =>
        diff(correct.byModel[m].matrix, incorrect.byModel[m].matrix)
      ),
    ];
    return Math.max(0.02, ...all.flat(2).map((v) => Math.abs(v)));
  }, [data]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No plot data for this taxonomy. Run{" "}
        <code className="text-xs">scripts/generate_plots.py</code>.
      </div>
    );
  }

  const name = (slug: string) => metadata?.models[slug]?.display_name ?? slug;
  const all = data.subsets.all;
  const dir = `/data/plots/${data.pipeline}`;

  const card =
    "rounded-lg border bg-background hover:border-foreground/25 transition-colors overflow-hidden text-left";

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 md:p-6 space-y-8 max-w-[1400px] mx-auto">
        {/* Chord */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Chord diagram</h2>
            <p className="text-xs text-muted-foreground">
              Movement between reasoning states across all traces. Self-transitions and
              transitions below {data.minP} are omitted so the figure stays readable.
            </p>
          </div>
          <button
            type="button"
            className={`${card} block w-full`}
            title="Click to enlarge"
            onClick={() =>
              setZoom({ src: `${dir}/chord_${OVERALL}.svg`, title: "Chord — All models" })
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${dir}/chord_${OVERALL}.svg`} alt="Chord, all models" className="w-full max-h-[520px] object-contain bg-white" />
            <div className="px-2 py-1.5 border-t">
              <div className="text-[11px] font-medium">All models</div>
              <div className="text-[10px] text-muted-foreground">
                {all.overall.traces.toLocaleString()} traces ·{" "}
                {all.overall.transitions.toLocaleString()} transitions
              </div>
            </div>
          </button>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.models.map((m) => (
              <button
                key={m}
                type="button"
                className={card}
                title="Click to enlarge"
                onClick={() =>
                  setZoom({ src: `${dir}/chord_${m}.svg`, title: `Chord — ${name(m)}` })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${dir}/chord_${m}.svg`} alt={name(m)} loading="lazy" className="w-full max-h-[260px] object-contain bg-white" />
                <div className="px-2 py-1.5 border-t">
                  <div className="text-[11px] font-medium truncate">{name(m)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {all.byModel[m]?.traces.toLocaleString()} traces
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Sankey */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Sankey diagram</h2>
            <p className="text-xs text-muted-foreground">
              The same one-step transitions, current state on the left and next state on the
              right. Hover a link to highlight it and read the transition.
            </p>
          </div>
          <div className="rounded-lg border bg-background p-2">
            <div className="text-[11px] font-medium mb-1">All models</div>
            <SankeyPlot
              links={data.sankey[OVERALL] ?? []}
              states={data.states}
              colors={data.colors}
              height={440}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {data.models.map((m) => (
              <div key={m} className="rounded-lg border bg-background p-2">
                <div className="text-[11px] font-medium truncate mb-1">{name(m)}</div>
                <SankeyPlot
                  links={data.sankey[m] ?? []}
                  states={data.states}
                  colors={data.colors}
                  height={230}
                  compact
                />
              </div>
            ))}
          </div>
        </section>

        {/* Transition matrix — all traces, Blues */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Transition matrix — all traces</h2>
            <p className="text-xs text-muted-foreground">
              P(next state | current state), row-normalised and complete: every cell is
              shown. Rare transitions read white, common ones deep blue.
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-background">
            <div className="text-[11px] font-medium mb-2">All models</div>
            <TransitionMatrix
              matrix={all.overall.matrix}
              states={data.states}
              colors={data.colors}
              scheme="blues"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.models.map((m) => (
              <button
                key={m}
                type="button"
                className={`${card} p-2`}
                title="Click to enlarge"
                onClick={() =>
                  setZoom({
                    title: `Transition matrix — ${name(m)}`,
                    node: (
                      <TransitionMatrix
                        matrix={all.byModel[m].matrix}
                        states={data.states}
                        colors={data.colors}
                        scheme="blues"
                      />
                    ),
                  })
                }
              >
                <div className="text-[11px] font-medium truncate mb-1">{name(m)}</div>
                <TransitionMatrix
                  compact
                  matrix={all.byModel[m].matrix}
                  states={data.states}
                  colors={data.colors}
                  scheme="blues"
                />
              </button>
            ))}
          </div>
        </section>

        {/* Transition matrix — correct minus incorrect */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">
              Transition matrix — correct − incorrect
            </h2>
            <p className="text-xs text-muted-foreground">
              Difference between the correct-trace and incorrect-trace matrices.{" "}
              <span className="text-emerald-600 font-medium">Green</span> = more common when
              the model answers correctly,{" "}
              <span className="text-red-600 font-medium">red</span> = more common when it is
              wrong. Shared scale (±{diffScale.toFixed(2)}) across every model.
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-background">
            <div className="text-[11px] font-medium mb-2">All models</div>
            <TransitionMatrix
              matrix={diff(
                data.subsets.correct.overall.matrix,
                data.subsets.incorrect.overall.matrix
              )}
              states={data.states}
              colors={data.colors}
              scheme="diff"
              scale={diffScale}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.models.map((m) => {
              const d = diff(
                data.subsets.correct.byModel[m].matrix,
                data.subsets.incorrect.byModel[m].matrix
              );
              return (
                <button
                  key={m}
                  type="button"
                  className={`${card} p-2`}
                  title="Click to enlarge"
                  onClick={() =>
                    setZoom({
                      title: `Correct − incorrect — ${name(m)}`,
                      node: (
                        <TransitionMatrix
                          matrix={d}
                          states={data.states}
                          colors={data.colors}
                          scheme="diff"
                          scale={diffScale}
                        />
                      ),
                    })
                  }
                >
                  <div className="text-[11px] font-medium truncate mb-1">{name(m)}</div>
                  <TransitionMatrix
                    compact
                    matrix={d}
                    states={data.states}
                    colors={data.colors}
                    scheme="diff"
                    scale={diffScale}
                  />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          <div
            className="bg-background rounded-lg max-w-[95vw] max-h-[92vh] overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="text-sm font-medium">{zoom.title}</div>
              <button
                type="button"
                onClick={() => setZoom(null)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {zoom.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={zoom.src}
                alt={zoom.title}
                className="bg-white rounded max-w-[90vw] max-h-[80vh] w-auto h-auto"
              />
            ) : (
              zoom.node
            )}
          </div>
        </div>
      )}
    </div>
  );
}
