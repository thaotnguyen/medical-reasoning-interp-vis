import useSWR from "swr";
import type { Case } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useCases(model: string, dataset: string) {
  const { data, error, isLoading } = useSWR<Case[]>(
    model && dataset ? `/data/cases/${model}_${dataset}.json` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return { cases: data, error, isLoading };
}
