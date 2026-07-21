import useSWR from "swr";
import type { Case, Pipeline } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Fetches per-model geometric cases. `pipeline` and `dataset` are kept in the
 * signature for back-compat with callers but only `model` is consumed.
 */
export function usePipelineCases(
  pipeline: Pipeline,
  model: string,
  _dataset: string
) {
  void _dataset;
  const url = model
    ? `/data/pipelines/${pipeline}/cases/${model}.json`
    : null;

  const { data, error, isLoading } = useSWR<Case[]>(url, fetcher, {
    revalidateOnFocus: false,
  });
  return { cases: data, error, isLoading };
}
