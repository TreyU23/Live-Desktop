import { useEffect, useRef, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { ChatComposer, ChatLayout, ChatMessage, ChatMessageBubble, ChatMessageList } from '@astryxdesign/core/Chat';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { LayoutPanel, HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector } from '@astryxdesign/core/Selector';
import { Heading, Text } from '@astryxdesign/core/Text';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Page } from '../components/shell/Page.jsx';
import { ApprovalSheet } from '../components/approvals/ApprovalSheet.jsx';
import { icons } from '../components/ui/icons.js';

const kNew = '__new__';

function threadTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ConversationsView({ conversations, selected, onSelect, onSend, busy, profileName, configured, actions = [], onApprove, onReject, headerActions }) {
  const isWide = useMediaQuery('(min-width: 768px)');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const pending = actions.filter(action => action.status === 'pending');
  // Actions carry no conversation id, so the dialog opens by itself only for requests that appear
  // while this view is open (for example after sending a message). Older ones wait behind "Review".
  const seen = useRef(null);
  useEffect(() => {
    if (seen.current == null) { seen.current = new Set(pending.map(action => action.id)); return; }
    const fresh = pending.filter(action => !seen.current.has(action.id));
    fresh.forEach(action => seen.current.add(action.id));
    if (fresh.length) setSheetOpen(true);
  }, [pending.map(action => action.id).join('|')]);

  const submit = async text => {
    const draft = text ?? value;
    if (busy || !draft.trim()) return;
    setError('');
    if (await onSend(draft.trim(), selected?.id ?? null)) setValue(current => current === draft ? '' : current);
    else setError('Message could not be sent. Your draft is preserved; try again.');
  };
  const choose = summary => onSelect(summary);
  const messages = selected?.messages || [];

  const threads = <VStack gap={2} aria-label="Conversation threads">
    <HStack gap={2} vAlign="center">
      <StackItem size="fill"><Heading level={2}>Threads</Heading></StackItem>
      <Button label="New" aria-label="New conversation" size="sm" icon={<Icon icon={icons.Plus} />} isDisabled={busy} onClick={() => choose(null)} />
    </HStack>
    {conversations.length ? <List>
      {conversations.map(conversation => <ListItem key={conversation.id}
        label={conversation.title}
        description={`${conversation.messageCount} ${conversation.messageCount === 1 ? 'message' : 'messages'}`}
        endContent={<Text type="supporting">{threadTime(conversation.updatedAt)}</Text>}
        isSelected={selected?.id === conversation.id}
        isDisabled={busy}
        onClick={() => choose(conversation)} />)}
    </List> : <Text type="supporting">No saved conversations yet.</Text>}
  </VStack>;

  const reviewButton = pending.length
    ? <Button label={`Review ${pending.length === 1 ? 'request' : 'requests'}`} endContent={<Badge label={String(pending.length)} />} onClick={() => setSheetOpen(true)} />
    : null;

  const chat = <VStack gap={4}>
    <HStack gap={3} vAlign="center" wrap="wrap">
      <StackItem size="fill">
        {isWide ? <Heading level={2}>{selected?.title || 'New conversation'}</Heading>
          : <Selector label="Conversation" value={selected?.id ?? kNew} isDisabled={busy}
            onChange={id => choose(id === kNew ? null : conversations.find(item => item.id === id) || null)}
            options={[{ value: kNew, label: 'New conversation' }, ...conversations.map(item => ({ value: item.id, label: item.title }))]} />}
      </StackItem>
      {reviewButton}
    </HStack>
    {!configured ? <Banner status="warning" title="OpenAI key not set" description="Add it in Settings to send messages. History is stored on this PC; assistant requests and context are sent to OpenAI." /> : null}
    <ChatLayout scrollButton={null}
      emptyState={<EmptyState title="Start a conversation" description="Ask about your files, system, or current work. Anything that changes your PC asks for approval first." />}
      composer={<VStack gap={2}>
        <ChatComposer value={value} onChange={setValue} onSubmit={submit} placeholder="Message Live Desktop" isDisabled={busy} elevation="none"
          status={error ? { type: 'error', message: error } : undefined} />
        <Text type="supporting">Anything that changes your PC asks for approval first. History stays on this PC; messages are sent to OpenAI.</Text>
      </VStack>}>
      {messages.length ? <ChatMessageList align="top" isStreaming={busy}>
        {messages.map(message => message.role === 'user'
          ? <ChatMessage key={message.id} sender="user"><ChatMessageBubble>{message.content}</ChatMessageBubble></ChatMessage>
          : <ChatMessage key={message.id} sender="assistant"><ChatMessageBubble variant="ghost" name="Live Desktop">{message.content}</ChatMessageBubble></ChatMessage>)}
      </ChatMessageList> : null}
    </ChatLayout>
  </VStack>;

  return <Page title="Conversations" detail={`Ask about this PC or request a change. ${profileName} · stored on this PC.`} actions={headerActions}
    start={isWide ? <LayoutPanel width={300} hasDivider padding={6} label="Conversation threads">{threads}</LayoutPanel> : undefined}>
    {chat}
    {sheetOpen && pending.length ? <ApprovalSheet actions={pending} onApprove={onApprove} onReject={onReject} onClose={() => setSheetOpen(false)} /> : null}
  </Page>;
}
