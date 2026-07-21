export type PoolPhase = "training" | "test";

export function getPoolPhase(index: number, isTraining?: boolean): PoolPhase {
  if (isTraining || index < 3) {
    return "training";
  }

  return "test";
}

export function consumePointerAction(
  event: { stopPropagation?: () => void },
  action: () => void
): void {
  event.stopPropagation?.();
  action();
}
