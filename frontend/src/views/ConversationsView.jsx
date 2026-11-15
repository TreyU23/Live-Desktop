import { useEffect, useRef, useState } from 'react';
import { EmptyState, Icon } from '../components/ui/index.jsx';
import { ApprovalSheet } from '../components/approvals/ApprovalSheet.jsx';

export function ConversationsView({ conversations, selected, onSelect, onSend, busy, profileName, configured, actions = [], onApprove, onReject, headerActions }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const composer = useRef(null);
  const pending = actions.filter(action => action.status === 'pending');
  // Actions carry no conversation id, so the sheet opens by itself only for requests that appear
  // while this view is open (for example after sending a message). Older ones wait behind "Review".
  const seen = useRef(null);
  useEffect(() => {
    if (seen.current == null) { seen.current = new Set(pending.map(action => action.id)); return; }
    const fresh = pending.filter(action => !seen.current.has(action.id));
    fresh.forEach(action => seen.current.add(action.id));
    if (fresh.length) setSheetOpen(true);
  }, [pending.map(action => action.id).join('|')]);

  const submit = async event => {
    event?.preventDefault();
    if (busy || !value.trim()) return;
    const draft = value; setError('');
    if (await onSend(draft.trim(), selected?.id ?? null)) setValue(current => current === draft ? '' : current);
    else setError('Message could not be sent. Your draft is preserved; try again.');
  };
  const choose = summary => { setThreadsOpen(false); onSelect(summary); };
  return <main className="view-shell conversations-view">
    <div className="conversation-layout">
      <aside className="conversation-threads" aria-label="Conversation threads">
        <header className="page-heading conversation-threads__heading">
          <div><h1 tabIndex={-1}>Conversations</h1><p>{profileName} · stored on this PC</p></div>
          <button className="btn-icon new-chat" type="button" aria-label="New conversation" onClick={() => choose(null)} disabled={busy}><Icon name="Plus" size={18} strokeWidth={2.2} /></button>
        </header>
        <button className="thread-toggle" type="button" aria-expanded={threadsOpen} aria-controls="conversation-threads" onClick={() => setThreadsOpen(open => !open)}>Threads · {selected?.title || 'New conversation'}</button>
        <div id="conversation-threads" className={`conversation-list ${threadsOpen ? 'conversation-list--open' : ''}`}>
          {conversations.map(conversation => <button className="thread-row" aria-current={selected?.id === conversation.id ? 'true' : undefined} type="button" key={conversation.id} onClick={() => choose(conversation)} disabled={busy}><strong>{conversation.title}</strong><span>{conversation.messageCount} messages</span></button>)}
          {!conversations.length ? <p className="muted conversation-list__empty">No saved conversations yet.</p> : null}
        </div>
      </aside>
      <section className="card card--flush chat-panel" aria-label="Conversation">
        <header className="chat-header">
          <div><h2>{selected?.title || 'New conversation'}</h2><span className="muted">History is stored locally. Assistant requests and context are sent to OpenAI.</span></div>
          <div className="chat-header__status">
            {!configured ? <span className="status-label"><i className="status-dot status-dot--warn" aria-hidden="true" />OpenAI key not set — add it in Settings</span> : null}
            {pending.length ? <button type="button" className="chip" onClick={() => setSheetOpen(true)}><span className="badge" aria-hidden="true">{pending.length}</span>Review {pending.length === 1 ? 'request' : 'requests'}</button> : null}
            {headerActions}
          </div>
        </header>
        <div className="messages" aria-live="polite">
          {selected?.messages?.length ? selected.messages.map(message => <article className={`message message--${message.role}`} key={message.id} aria-label={message.role === 'user' ? 'You' : 'Live Desktop'}><h3 className="visually-hidden">{message.role === 'user' ? 'You' : 'Live Desktop'}</h3><p>{message.content}</p></article>) : <EmptyState icon="MessageCircle" title="Start a conversation" detail="Ask about your files, system, or current work. Anything that changes your PC asks for approval first." />}
        </div>
        <form className="chat-compose" onSubmit={submit}>
          <div className="pill-input">
            <label className="visually-hidden" htmlFor="chat-message">Message your assistant</label>
            <textarea id="chat-message" ref={composer} value={value} rows={1} placeholder="Message Live Desktop"
              onChange={event => setValue(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
            <button className="btn-round-primary" type="submit" aria-label="Send" disabled={busy || !value.trim()}><Icon name={busy ? 'LoaderCircle' : 'ArrowUp'} size={18} strokeWidth={2.4} className={busy ? 'spin' : ''} /></button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </form>
      </section>
    </div>
    {sheetOpen && pending.length ? <ApprovalSheet actions={pending} onApprove={onApprove} onReject={onReject} onClose={() => setSheetOpen(false)} returnFocus={() => composer.current} /> : null}
  </main>;
}
