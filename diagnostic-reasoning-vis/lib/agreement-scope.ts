export function buildAgreementCasesMap<T>(
  casesMap: Record<string, T[]>,
  labelerPool: ReadonlyArray<{
    model: string;
    dataset: string;
    caseIndex: number;
  }>
): Record<string, T[]> {
  if (labelerPool.length === 0) {
    return casesMap;
  }

  const allowed = new Map<string, Set<number>>();

  for (const item of labelerPool) {
    const key = `${item.model}_${item.dataset}`;
    const existing = allowed.get(key) ?? new Set<number>();
    existing.add(item.caseIndex);
    allowed.set(key, existing);
  }

  const filtered: Record<string, T[]> = {};

  for (const [key, cases] of Object.entries(casesMap)) {
    const allowedIndices = allowed.get(key);
    if (!allowedIndices) continue;

    const scopedCases = cases.filter((_, index) => allowedIndices.has(index));
    if (scopedCases.length > 0) {
      filtered[key] = scopedCases;
    }
  }

  return filtered;
}
