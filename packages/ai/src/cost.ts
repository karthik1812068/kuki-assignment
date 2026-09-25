export function estimateModelCost(
  inputTokens: number,
  outputTokens: number,
  inputUsdPerMillion: number | undefined,
  outputUsdPerMillion: number | undefined,
): number | null {
  if (inputUsdPerMillion === undefined || outputUsdPerMillion === undefined) {
    return null;
  }
  if (
    !Number.isFinite(inputUsdPerMillion) ||
    !Number.isFinite(outputUsdPerMillion) ||
    inputUsdPerMillion < 0 ||
    outputUsdPerMillion < 0
  ) {
    return null;
  }
  const cost =
    (inputTokens / 1_000_000) * inputUsdPerMillion +
    (outputTokens / 1_000_000) * outputUsdPerMillion;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
