export function adaptResourceStatus(previous = {}, status, now = Date.now()) {
  const succeeded = !status.loading && !status.error && status.readyAt != null;
  return { ...status, manual: status.loading ? previous.manual : false, hasData: previous.hasData || succeeded, lastSuccessAt: succeeded ? now : previous.lastSuccessAt ?? null };
}

export function resourceViewState(status) {
  if (!status?.hasData) return status?.error ? 'error' : 'loading';
  return status.error ? 'stale' : 'ready';
}
