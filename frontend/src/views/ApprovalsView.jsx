import { useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Table, useTableRowExpansion } from '@astryxdesign/core/Table';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Page } from '../components/shell/Page.jsx';
import { actionDetails } from '../presentation/actionDetails.js';

const kStatus = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'success', label: 'Allowed' },
  completed: { variant: 'success', label: 'Completed' },
  rejected: { variant: 'neutral', label: 'Not allowed' },
  failed: { variant: 'error', label: 'Failed' },
};
const statusOf = status => kStatus[status] || { variant: 'neutral', label: status || 'Unknown' };

export function ActionState({ status, override }) {
  const state = statusOf(status);
  return <HStack gap={2} vAlign="center"><StatusDot variant={state.variant} label={state.label} /><Text>{override || state.label}</Text></HStack>;
}

function requestedAt(action) {
  if (!action.createdAt) return 'Time not recorded';
  const date = new Date(action.createdAt);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Everything the decision depends on: operation, target, reusable scope and the full content.
function ActionDetails({ action }) {
  const details = actionDetails(action);
  return <VStack gap={4} paddingBlock={2} aria-label={`Details for ${action.reason}`}>
    <Heading level={3}>{details.title}</Heading>
    <MetadataList>
      <MetadataListItem label="Operation">{details.operation}</MetadataListItem>
      <MetadataListItem label="Target"><Text type="code">{details.target || 'Not supplied'}</Text></MetadataListItem>
      <MetadataListItem label="Reusable approval scope">{details.scope}</MetadataListItem>
      <MetadataListItem label="Requested">{action.createdAt ? new Date(action.createdAt).toLocaleString() : 'Time not recorded'}{action.updatedAt ? ` · Updated ${new Date(action.updatedAt).toLocaleString()}` : ''}</MetadataListItem>
    </MetadataList>
    {details.content != null ? <VStack as="section" gap={2} aria-label="Action content">
      <Text weight="medium">Full content</Text>
      <CodeBlock code={String(details.content)} isWrapped maxHeight={320} width="100%" />
    </VStack> : null}
    {action.error ? <Banner status="error" title="Execution failed" description={action.error} /> : null}
    {action.result != null ? <Collapsible label="Execution result">
      <CodeBlock code={typeof action.result === 'string' ? action.result : JSON.stringify(action.result, null, 2)} isWrapped width="100%" />
    </Collapsible> : null}
  </VStack>;
}

// Queue and history. Pending rows decide inline; the row's details hold the full content and scope.
export function ApprovalsView({ actions, onApprove, onReject, headerActions }) {
  const [filter, setFilter] = useState('pending');
  const [expanded, setExpanded] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(null);
  const pendingCount = actions.filter(action => action.status === 'pending').length;
  const visible = actions.filter(action => filter === 'pending' ? action.status === 'pending' : action.status !== 'pending');

  const decide = async (action, verb) => {
    if (submitting) return;
    setSubmitting(action.id);
    try { await (verb === 'approve' ? onApprove : onReject)(action.id); } finally { setSubmitting(null); }
  };
  const toggle = key => setExpanded(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const expansion = useTableRowExpansion({
    expandedKeys: expanded,
    onToggle: toggle,
    getRowKey: action => String(action.id),
    getRowLabel: action => action.reason,
    renderExpanded: action => <ActionDetails action={action} />,
  });

  const columns = [
    { key: 'reason', header: 'Action', width: '28%', renderCell: action => <Text weight="medium">{action.reason}</Text> },
    { key: 'how', header: 'How', width: '26%', renderCell: action => actionDetails(action).how },
    { key: 'createdAt', header: 'Requested', width: '14%', renderCell: requestedAt },
    { key: 'status', header: 'State', width: '12%', renderCell: action => <ActionState status={action.status} override={submitting === action.id ? 'Submitting…' : undefined} /> },
    ...(filter === 'pending' ? [{ key: 'decision', header: 'Decision', renderCell: action => <HStack gap={2} wrap="wrap">
      <Button label="Don’t Allow" aria-label={`Don’t allow ${action.reason}`} isDisabled={Boolean(submitting)} onClick={() => decide(action, 'reject')} />
      <Button label="Allow" aria-label={`Allow ${action.reason}`} variant="primary" isLoading={submitting === action.id}
        isDisabled={Boolean(submitting) || actionDetails(action).unsupported} onClick={() => decide(action, 'approve')} />
    </HStack> }] : []),
  ];

  return <Page title="Approvals" detail="Every change to your PC waits here until you decide." actions={headerActions}>
    <VStack gap={6}>
      <TabList value={filter} onChange={value => { setFilter(value); setExpanded(new Set()); }} hasDivider>
        <Tab value="pending" label="Pending" endContent={pendingCount ? <Badge label={String(pendingCount)} /> : undefined} />
        <Tab value="history" label="History" />
      </TabList>
      <Banner status="info" title="Allowing a request also allows matching requests later."
        description="Open a row to see the full content and the reusable scope first. An execution failure does not revoke an approval. Approvals belong to the current local profile." />
      {visible.length
        ? <Table data={visible} columns={columns} idKey="id" hasHover verticalAlign="middle" plugins={{ expansion }} />
        : <EmptyState title={filter === 'pending' ? 'Nothing needs review' : 'No action history'} description="New assistant and system actions appear here." />}
    </VStack>
  </Page>;
}
