import { useState } from 'react';
import { Icon, EmptyState, ViewShell } from '../components/ui/index.jsx';
export function MemoriesView({ memories, onCreate, onDelete }) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('preference');
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true); setError('');
    const draft = content;
    try { if (await onCreate(draft.trim(), category)) setContent(current => current === draft ? '' : current); else setError('Memory could not be saved. Your draft is preserved; try again.'); }
    finally { setSaving(false); }
  };
  const visible = memories.filter(memory => filter === 'all' || memory.category === filter);
  return <ViewShell title="Memories" detail="Local records for this profile. Inspect what is remembered and remove it at any time.">
    <div className="memory-workspace"><section className="memory-records"><div className="view-toolbar"><label>Show category <select aria-label="Filter memory category" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All categories</option>{[...new Set(memories.map(memory => memory.category))].sort().map(value => <option key={value}>{value}</option>)}</select></label><span>{visible.length} records</span></div>
      {!visible.length ? <EmptyState icon="Bookmark" title="No memories here" detail="Add a record or change the category filter." /> : null}
      <div className="memory-grid">{visible.map(memory => <article className="memory-item" key={memory.id}><span>{memory.category}</span><p>{memory.content}</p><button type="button" disabled={deleting != null} aria-label="Delete memory" onClick={async () => { setDeleting(memory.id); try { await onDelete(memory.id); } finally { setDeleting(null); } }}><Icon name="Trash2" size={17} />{deleting === memory.id ? 'Deleting…' : 'Delete'}</button></article>)}</div>
    </section><form className="memory-form" onSubmit={submit}><h2>Add a memory</h2><label htmlFor="memory-content">Memory content</label><textarea id="memory-content" value={content} onChange={event => setContent(event.target.value)} placeholder="Remember a preference or project detail" maxLength={2000} required /><label htmlFor="memory-category">Memory category</label><select id="memory-category" value={category} onChange={event => setCategory(event.target.value)}>{['preference', 'project', 'fact', 'instruction'].map(value => <option key={value}>{value}</option>)}</select><button className="primary-button" type="submit" disabled={saving || !content.trim()}><Icon name="Plus" size={17} />{saving ? 'Saving…' : 'Add memory'}</button>{error ? <p className="form-error" role="alert">{error}</p> : null}</form></div>
  </ViewShell>;
}
