/**
 * Utilitários estatísticos.
 */

export function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export function confidenceInterval95(meanVal, sd, n) {
  if (n <= 0) return [meanVal, meanVal];
  const se = sd / Math.sqrt(n);
  return [meanVal - 1.96 * se, meanVal + 1.96 * se];
}
