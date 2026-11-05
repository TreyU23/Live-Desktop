/** Utilization thresholds for gauges/bars: ready <75, attention 75–89, error ≥90. */
export function utilizationSeverity(value) {
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  if (value >= 90) return "critical";
  if (value >= 75) return "elevated";
  return "normal";
}

export function utilizationSeverityClass(value, prefix = "gauge") {
  const severity = utilizationSeverity(value);
  return severity ? `${prefix}--${severity}` : "";
}
