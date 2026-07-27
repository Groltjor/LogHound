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

export function formatDistance(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "n/d";
  if (Math.abs(numeric) < 1) return numeric.toFixed(3);
  if (Math.abs(numeric) < 10) return numeric.toFixed(2);
  return numeric.toFixed(1);
}

export function formatTimeWindow(value) {
  if (!value) return "Sin ventana";

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return String(value);
}
