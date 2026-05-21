import useSWR from "swr";
import { useMemo } from "react";
import type { Pipeline, PipelineTaxonomy, TaxonomyItem } from "@/lib/types";
import { TAXONOMY_COLORS } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Fetches /data/pipelines/geometric/taxonomy.json. */
export function usePipelineTaxonomy(_pipeline: Pipeline) {
  void _pipeline;
  const { data, error, isLoading } = useSWR<PipelineTaxonomy>(
    "/data/pipelines/geometric/taxonomy.json",
    fetcher,
    { revalidateOnFocus: false }
  );

  const taxonomy: TaxonomyItem[] = useMemo(() => {
    if (!data?.states) return [];
    return data.states.map((s, i) => ({
      ...s,
      color: s.color ?? TAXONOMY_COLORS[i % TAXONOMY_COLORS.length],
    }));
  }, [data]);

  return { taxonomy, raw: data ?? null, error, isLoading };
}
