// packages/webview-client/src/shared/utils/clamp.ts
// numeric clamp & round helpers for UI state

// round to hundredths to avoid floating-point drift
export function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

// clamp to [min, max] then round to hundredths
export function clampToHundredths(
  value: number,
  min: number,
  max: number
): number {
  return roundToHundredths(Math.max(min, Math.min(max, value)));
}
