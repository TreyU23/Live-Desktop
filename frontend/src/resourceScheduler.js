// Completion-based polling: one read per key, explicit invalidation after writes,
// and no routine requests while the document is hidden.
export function createResourceScheduler({ read, visible = () => typeof document === 'undefined' || !document.hidden, status = () => {}, clock = globalThis }) {
  const entries = new Map();
  let stopped = false;
  function register(key, { path, apply, interval = 60000, timeout = 12000, error = () => {} }) {
    entries.set(key, { path, apply, interval, timeout, error, generation: 0 });
  }
  function schedule(key, entry) {
    clock.clearTimeout(entry.timer);
    if (!stopped && visible() && entry.interval > 0) entry.timer = clock.setTimeout(() => refresh(key).catch(() => {}), entry.interval);
  }
  function refresh(key, override) {
    const entry = entries.get(key);
    if (!entry || stopped) return Promise.resolve(null);
    if (entry.pending) return entry.pending;
    clock.clearTimeout(entry.timer);
    const generation = entry.generation;
    const controller = new AbortController();
    entry.controller = controller;
    status(key, { loading: true, stale: Boolean(entry.value), error: null });
    const deadline = clock.setTimeout(() => controller.abort(), entry.timeout);
    entry.pending = Promise.resolve().then(() => read(override || (typeof entry.path === 'function' ? entry.path() : entry.path), controller.signal))
      .then(value => {
        if (stopped || generation !== entry.generation || controller.signal.aborted) return null;
        entry.value = value;
        entry.apply(value);
        status(key, { loading: false, stale: false, error: null, readyAt: globalThis.performance?.now() ?? Date.now() });
        return value;
      }).catch(error => {
        if (!stopped && generation === entry.generation) {
          const message = controller.signal.aborted ? 'Refresh timed out. Try again.' : error.message;
          status(key, { loading: false, stale: Boolean(entry.value), error: message });
          entry.error(message);
        }
        throw error;
      }).finally(() => {
        clock.clearTimeout(deadline);
        entry.pending = null;
        entry.controller = null;
        schedule(key, entry);
      });
    return entry.pending;
  }
  async function invalidate(key) {
    const entry = entries.get(key);
    if (!entry) return;
    entry.generation += 1;
    entry.controller?.abort();
    await entry.pending?.catch(() => {});
  }
  function visibilityChanged() {
    for (const [key, entry] of entries) {
      clock.clearTimeout(entry.timer);
      if (visible() && entry.interval > 0) refresh(key).catch(() => {});
    }
  }
  function stop() {
    stopped = true;
    for (const entry of entries.values()) {
      entry.generation += 1;
      clock.clearTimeout(entry.timer);
      entry.controller?.abort();
    }
  }
  return { register, refresh, invalidate, visibilityChanged, stop };
}
