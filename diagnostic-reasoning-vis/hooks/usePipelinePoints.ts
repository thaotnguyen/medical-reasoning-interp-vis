import useSWR from "swr";
import type { Pipeline, TSNEPoint } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Fetches the per-model 2-D point cloud for the geometric pipeline.
 *  Path: /data/pipelines/geometric/points/{model}.json
 */
export function usePipelinePoints(
  pipeline: Pipeline,
  model: string | null,
  enabled = true
) {
  const url =
    enabled && model
      ? `/data/pipelines/${pipeline}/points/${model}.json`
      : null;

  const { data, error, isLoading } = useSWR<TSNEPoint[]>(url, fetcher, {
    revalidateOnFocus: false,
  });
  return { points: data ?? null, error, isLoading };
}
