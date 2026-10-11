const enabled = typeof location !== 'undefined' && new URLSearchParams(location.search).get('diagnostics') === '1';
const samples = [];
export function recordTiming(resource, phase, duration = 0) {
  if (!enabled) return;
  // Resource names only: no URL query, profile IDs, response bodies or credentials.
  samples.push({ resource, phase, at: performance.now(), duration });
  if (samples.length > 1000) samples.shift();
}
if (enabled) window.liveDesktopTimings = () => samples.map(sample => ({ ...sample }));
