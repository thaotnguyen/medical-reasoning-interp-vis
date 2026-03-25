import useSWRImmutable from "swr/immutable";
import type { Metadata } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMetadata() {
  const { data, error, isLoading } = useSWRImmutable<Metadata>(
    "/data/metadata.json",
    fetcher
  );
  return { metadata: data, error, isLoading };
}
