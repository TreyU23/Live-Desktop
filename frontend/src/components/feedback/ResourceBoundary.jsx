import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { resourceViewState } from '../../presentation/resourceViewState.js';

// Loading, stale and error states for one service, rendered where that service's content goes.
// A plain wrapper, not a landmark. Stale data stays visible under the error.
export function ResourceBoundary({ name, status, onRetry, children }) {
  const state = resourceViewState(status);
  const retry = status?.error
    ? <Button label={`Retry ${name.toLowerCase()}`} size="sm" isDisabled={status.loading} onClick={onRetry} />
    : undefined;
  return <VStack gap={3} data-resource={name}>
    {status?.manual && status.loading && status.hasData ? <Text type="supporting" role="status">Refreshing {name.toLowerCase()}…</Text> : null}
    {state === 'loading' && !status?.error ? <HStack gap={2} vAlign="center"><Spinner size="sm" aria-hidden="true" /><Text type="supporting">Waiting for {name.toLowerCase()} data</Text></HStack> : null}
    {state === 'error' || state === 'stale' ? <Banner status={state === 'error' ? 'error' : 'warning'} role="status"
      title={`${name}: ${status.error}`}
      description={state === 'stale' ? `Last updated ${new Date(status.lastSuccessAt).toLocaleTimeString()}` : undefined}
      endContent={retry} /> : null}
    {state === 'ready' || state === 'stale' ? children : null}
  </VStack>;
}
