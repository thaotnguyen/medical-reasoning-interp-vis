"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useMetadata } from "@/hooks/useMetadata";
import { useAppState } from "@/hooks/useAppState";
import { Skeleton } from "@/components/ui/skeleton";
import { TransitionMatrix } from "./TransitionMatrix";

type Entry = { matrix: number[][]; traces: number; transitions: number };
type Subset = { overall: Entry; byModel: Record<string, Entry> };
interface PlotsData {
  pipeline: string;
  states: string[];
  colors: string[];
  models: string[];
  minP: number;
  subsets: Record<"all" | "correct" | "incorrect", Subset>;
}

const OVERALL = "__all__";
const SUBSET_LABEL: Record<string, string> = {
  all: "All traces",
  correct: "Correct traces only",
  incorrect: "Incorrect traces only",
};

/** A figure with a caption; clicking it opens the enlarged view. */
function Figure({
  src,
  caption,
  sub,
  onOpen,
  big = false,
}: {
  src: string;
  caption: string;
  sub?: string;
  onOpen: () => void;
  big?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Click to enlarge"
      className="group text-left rounded-lg border bg-background hover:border-foreground/25 transition-colors overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={caption}
        loading="lazy"
        className={`w-full ${big ? "h-auto" : "h-auto"} bg-white`}
      />
      <div className="px-2 py-1.5 border-t">
        <div className="text-[11px] font-medium truncate">{caption}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </button>
  );
}

export function PlotsPanel() {
  const { metadata } = useMetadata();
  const { selectedPipeline } = useAppState();
  const [data, setData] = useState<PlotsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subset, setSubset] = useState<"all" | "correct" | "incorrect">("all");
  const [zoom, setZoom] = useState<{ src?: string; node?: React.ReactNode; title: string } | null>(
    null
  );

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

  // Escape closes the enlarged view.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-40 w-full" />
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
  const S = data.subsets[subset];
  const dir = `/data/plots/${data.pipeline}`;
  const fig = (kind: "chord" | "sankey", key: string) =>
    `${dir}/${kind}_${subset}_${key}.svg`;

  const section = (
    kind: "chord" | "sankey",
    title: string,
    blurb: string
  ) => (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{blurb}</p>
      </div>
      <Figure
        big
        src={fig(kind, OVERALL)}
        caption="All models"
        sub={`${S.overall.traces.toLocaleString()} traces · ${S.overall.transitions.toLocaleString()} transitions`}
        onOpen={() =>
          setZoom({ src: fig(kind, OVERALL), title: `${title} — All models` })
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {data.models.map((m) => (
          <Figure
            key={m}
            src={fig(kind, m)}
            caption={name(m)}
            sub={`${(S.byModel[m]?.traces ?? 0).toLocaleString()} traces`}
            onOpen={() => setZoom({ src: fig(kind, m), title: `${title} — ${name(m)}` })}
          />
        ))}
      </div>
    </section>
  );

  const matrixSection = () => (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Transition matrix</h2>
        <p className="text-xs text-muted-foreground">
          P(next state | current state), row-normalised. Green is a rare transition, red a
          dominant one.
        </p>
      </div>
      <div className="rounded-lg border p-3 bg-background">
        <div className="text-[11px] font-medium mb-2">All models</div>
        <TransitionMatrix
          matrix={S.overall.matrix}
          states={data.states}
          colors={data.colors}
          minP={data.minP}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {data.models.map((m) => (
          <button
            key={m}
            type="button"
            title="Click to enlarge"
            onClick={() =>
              setZoom({
                title: `Transition matrix — ${name(m)}`,
                node: (
                  <TransitionMatrix
                    matrix={S.byModel[m].matrix}
                    states={data.states}
                    colors={data.colors}
                    minP={data.minP}
                  />
                ),
              })
            }
            className="text-left rounded-lg border p-2 bg-background hover:border-foreground/25 transition-colors overflow-hidden"
          >
            <div className="text-[11px] font-medium truncate mb-1">{name(m)}</div>
            <TransitionMatrix
              compact
              matrix={S.byModel[m].matrix}
              states={data.states}
              colors={data.colors}
              minP={data.minP}
            />
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 md:p-6 space-y-8 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
            {(["all", "correct", "incorrect"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubset(s)}
                aria-pressed={subset === s}
                className={
                  "px-2.5 py-1 text-xs rounded-[5px] transition-colors " +
                  (subset === s
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {SUBSET_LABEL[s]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Transitions below {data.minP} are hidden so the figures stay readable; the
            matrix shows them as blank cells.
          </p>
        </div>

        {section(
          "chord",
          "Chord diagram",
          "Movement between reasoning states. Ribbons are coloured by the state being left; self-transitions are excluded."
        )}
        {section(
          "sankey",
          "Sankey diagram",
          "The same one-step transitions, current state on the left and next state on the right."
        )}
        {matrixSection()}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          <div
            className="bg-background rounded-lg max-w-[95vw] max-h-[92vh] overflow-auto p-4 relative"
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
