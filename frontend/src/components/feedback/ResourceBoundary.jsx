import { resourceViewState } from '../../presentation/resourceViewState.js';
export function ResourceBoundary({ name, status, onRetry, children }) {
  const state = resourceViewState(status);
  // A plain wrapper, not a landmark: views inside it render their own <main>.
  return <div className={`resource-boundary resource-boundary--${state}`} data-resource={name}>
    {status?.manual && status.loading && status.hasData ? <p className="resource-feedback" role="status">Refreshing {name.toLowerCase()}…</p> : null}
    {state !== 'ready' ? <div className="resource-feedback" role={status?.error ? 'status' : undefined}>
      <span>{state === 'loading' ? `Waiting for ${name.toLowerCase()} data` : `${name}: ${status.error}`}
        {state === 'stale' ? ` · Last updated ${new Date(status.lastSuccessAt).toLocaleTimeString()}` : ''}</span>
      {status?.error ? <button type="button" onClick={onRetry} disabled={status.loading}>Retry {name.toLowerCase()}</button> : null}
    </div> : null}
    {(state === 'ready' || state === 'stale') ? children : null}
  </div>;
}
