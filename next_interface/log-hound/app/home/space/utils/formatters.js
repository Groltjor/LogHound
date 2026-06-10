export function formatNumber(value) {
  return new Intl.NumberFormat("es-MX").format(Math.round(value || 0));
}

export function formatMs(value) {
  if (!value) return "0 ms";
  if (value < 1000) return `${Math.round(value)} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}
