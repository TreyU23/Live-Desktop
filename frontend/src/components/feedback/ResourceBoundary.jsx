import { resourceViewState } from '../../presentation/resourceViewState.js';
export function ResourceBoundary({ name, status, onRetry, children }) {
  const state = resourceViewState(status);
  return <section className={`resource-boundary resource-boundary--${state}`} aria-label={`${name} resource`}>
    {status?.manual && status.loading && status.hasData ? <p className="resource-feedback" role="status">Refreshing {name.toLowerCase()}…</p> : null}
    {state !== 'ready' ? <div className="resource-feedback" role={status?.error ? 'status' : undefined}>
      <span>{state === 'loading' ? `Waiting for ${name.toLowerCase()} data` : `${name}: ${status.error}`}
        {state === 'stale' ? ` · Last updated ${new Date(status.lastSuccessAt).toLocaleTimeString()}` : ''}</span>
      {status?.error ? <button type="button" onClick={onRetry} disabled={status.loading}>Retry {name.toLowerCase()}</button> : null}
    </div> : null}
    {(state === 'ready' || state === 'stale') ? children : null}
  </section>;
}
