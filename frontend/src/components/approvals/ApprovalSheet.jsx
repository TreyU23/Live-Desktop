import { useEffect, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Dialog } from '@astryxdesign/core/Dialog';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Heading, Text } from '@astryxdesign/core/Text';
import { icons } from '../ui/icons.js';
import { actionDetails } from '../../presentation/actionDetails.js';

const sentenceCase = text => (text ? text.charAt(0).toLowerCase() + text.slice(1) : 'run this action');

// Modal queue of pending actions. The backend has no one-shot approval: allowing makes the scope
// reusable, so the dialog states that instead of offering a switch it cannot honor.
// Escape and "Decide later" close it without deciding; Dialog returns focus to the opener.
export function ApprovalSheet({ actions, onApprove, onReject, onClose }) {
  const [submitting, setSubmitting] = useState(false);
  const [index, setIndex] = useState(0);
  const position = Math.min(index, actions.length - 1);
  const action = actions[position];
  useEffect(() => { if (!action) onClose(); }, [action]);
  if (!action) return null;
  const details = actionDetails(action);
  const decide = async verb => {
    if (submitting) return;
    setSubmitting(true);
    try { await (verb === 'approve' ? onApprove : onReject)(action.id); }
    finally { setSubmitting(false); }
  };
  return <Dialog isOpen onOpenChange={open => { if (!open && !submitting) onClose(); }} width={480} padding={6} aria-label="Approval request">
    <VStack gap={4}>
      <HStack gap={2} vAlign="center">
        <StackItem size="fill"><Text type="supporting" role="status">Request {position + 1} of {actions.length}</Text></StackItem>
        {actions.length > 1 ? <>
          <IconButton variant="ghost" size="sm" label="Previous request" icon={<Icon icon={icons.ChevronLeft} />} isDisabled={position === 0 || submitting} onClick={() => setIndex(position - 1)} />
          <IconButton variant="ghost" size="sm" label="Next request" icon={<Icon icon={icons.ChevronRight} />} isDisabled={position === actions.length - 1 || submitting} onClick={() => setIndex(position + 1)} />
        </> : null}
      </HStack>
      <Heading level={2}>Allow Live Desktop to {sentenceCase(action.reason)}?</Heading>
      <MetadataList>
        <MetadataListItem label="Action">{details.operation}{details.target ? <> · <Text type="code">{details.target}</Text></> : null}</MetadataListItem>
        <MetadataListItem label="How">{details.how}</MetadataListItem>
        <MetadataListItem label="Requested">{action.createdAt ? new Date(action.createdAt).toLocaleString() : 'Time not recorded'}</MetadataListItem>
      </MetadataList>
      {details.content != null ? <CodeBlock code={String(details.content)} isWrapped maxHeight={240} width="100%" aria-label="Action content" /> : null}
      <Banner status="info" title="Allowing also allows matching requests later."
        description={`${details.scope} An execution failure does not revoke that approval.`} />
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button label="Decide later" variant="ghost" isDisabled={submitting} onClick={onClose} />
        <StackItem size="fill" />
        <Button label="Don’t Allow" isDisabled={submitting} onClick={() => decide('reject')} />
        <Button label="Allow" variant="primary" isLoading={submitting} isDisabled={submitting || details.unsupported} onClick={() => decide('approve')} />
      </HStack>
    </VStack>
  </Dialog>;
}
