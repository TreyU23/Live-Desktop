import { useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Selector } from '@astryxdesign/core/Selector';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Page } from '../components/shell/Page.jsx';
import { icons } from '../components/ui/icons.js';

const kCategories = ['preference', 'project', 'fact', 'instruction'];

function savedAt(memory) {
  if (!memory.createdAt) return 'Not recorded';
  const date = new Date(memory.createdAt);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Everything the assistant has saved for this profile, searchable, with delete behind a confirmation.
export function MemoriesView({ memories, onCreate, onDelete, headerActions }) {
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('preference');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const needle = query.trim().toLowerCase();
  const visible = memories.filter(memory => !needle || `${memory.content} ${memory.category}`.toLowerCase().includes(needle));

  const submit = async () => {
    if (!content.trim() || saving) return;
    setSaving(true); setError('');
    const draft = content;
    try {
      if (await onCreate(draft.trim(), category)) { setContent(current => current === draft ? '' : current); setAddOpen(false); }
      else setError('Memory could not be saved. Your draft is preserved; try again.');
    } finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try { await onDelete(pendingDelete.id); setPendingDelete(null); } finally { setDeleting(false); }
  };

  const columns = [
    { key: 'content', header: 'Memory', width: '52%' },
    { key: 'category', header: 'Category', width: '20%', renderCell: memory => <Text type="supporting">{memory.category}</Text> },
    { key: 'createdAt', header: 'Saved', width: '18%', renderCell: savedAt },
    { key: 'delete', header: 'Delete', renderCell: memory => <IconButton variant="ghost" label={`Delete memory: ${memory.content}`} tooltip="Delete"
      icon={<Icon icon={icons.Trash} />} isDisabled={deleting} onClick={() => setPendingDelete(memory)} /> },
  ];

  return <Page title="Memories" detail="What the assistant has saved for this profile. Inspect or delete anything." actions={headerActions}>
    <VStack gap={6}>
      <HStack gap={3} vAlign="center" wrap="wrap">
        <StackItem size="static">
          <TextInput type="search" label="Search memories" isLabelHidden placeholder="Search memories" value={query} onChange={setQuery} hasClear />
        </StackItem>
        <StackItem size="fill">
          <Text type="supporting">{memories.length === 1 ? '1 memory' : `${memories.length} memories`}, stored only on this PC</Text>
        </StackItem>
        <Button label="Add memory" icon={<Icon icon={icons.Plus} />} onClick={() => { setError(''); setAddOpen(true); }} />
      </HStack>
      {visible.length
        ? <Table data={visible} columns={columns} idKey="id" hasHover verticalAlign="middle" />
        : <EmptyState title={memories.length ? 'No memories match' : 'No memories yet'}
          description={memories.length ? 'Try a different search.' : 'Memories the assistant saves, and ones you add, appear here.'} />}
    </VStack>

    <Dialog isOpen={addOpen} onOpenChange={open => { if (!saving) setAddOpen(open); }} purpose="form" width={480} padding={4}>
      <VStack gap={4}>
        <DialogHeader title="Add a memory" subtitle="Saved only in this local profile." onOpenChange={setAddOpen} hasDivider={false} />
        <TextArea label="Memory content" value={content} onChange={setContent} placeholder="Remember a preference or project detail" maxLength={2000} htmlMaxLength={2000} rows={4} isRequired />
        <Selector label="Memory category" value={category} onChange={setCategory} options={kCategories.map(value => ({ value, label: value }))} />
        {error ? <Banner status="error" title="Not saved" description={error} role="alert" /> : null}
        <HStack gap={2} hAlign="end">
          <Button label="Cancel" variant="ghost" isDisabled={saving} onClick={() => setAddOpen(false)} />
          <Button label="Add memory" variant="primary" isLoading={saving} isDisabled={!content.trim()} onClick={submit} />
        </HStack>
      </VStack>
    </Dialog>

    <AlertDialog isOpen={Boolean(pendingDelete)} onOpenChange={open => { if (!open && !deleting) setPendingDelete(null); }}
      title="Delete this memory?" description={pendingDelete ? `“${pendingDelete.content}” will be removed from this profile. This can’t be undone.` : ''}
      actionLabel="Delete memory" isActionLoading={deleting} onAction={confirmDelete} />
  </Page>;
}
