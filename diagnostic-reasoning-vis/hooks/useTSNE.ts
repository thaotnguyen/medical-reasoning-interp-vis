import useSWR from "swr";
import type { TSNEPoint } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTSNE(model: string | null) {
  const { data, error, isLoading } = useSWR<TSNEPoint[]>(
    model ? `/data/tsne/${model}.json` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return { points: data ?? null, error, isLoading };
}
