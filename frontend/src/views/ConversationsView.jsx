import { useState } from 'react';
import { EmptyState, Icon, ViewShell } from '../components/ui/index.jsx';
export function ConversationsView({ conversations, selected, onSelect, onSend, busy, profileName, configured, pendingCount }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [threadsOpen, setThreadsOpen] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (busy || !value.trim()) return;
    const draft = value; setError('');
    if (await onSend(draft.trim(), selected?.id ?? null)) setValue(current => current === draft ? '' : current);
    else setError('Message could not be sent. Your draft is preserved; try again.');
  };
  const choose = summary => { setThreadsOpen(false); onSelect(summary); };
  return <ViewShell title="Conversations" detail="History is stored locally. Assistant requests and context are sent to OpenAI.">
    <div className="conversation-context"><span>{profileName}</span><span>{configured ? 'OpenAI key configured' : 'OpenAI key needed in Settings'}</span><span>{pendingCount} pending approvals</span></div>
    <button className="thread-toggle" type="button" aria-expanded={threadsOpen} aria-controls="conversation-threads" onClick={() => setThreadsOpen(value => !value)}>Threads · {selected?.title || 'New conversation'}</button>
    <div className="conversation-layout"><aside id="conversation-threads" className={`conversation-list ${threadsOpen ? 'conversation-list--open' : ''}`} aria-label="Conversation threads">
      <button className="new-chat" type="button" onClick={() => choose(null)} disabled={busy}><Icon name="Plus" size={17} />New conversation</button>
      {conversations.map(conversation => <button className={selected?.id === conversation.id ? 'selected' : ''} type="button" key={conversation.id} onClick={() => choose(conversation)} disabled={busy}><strong>{conversation.title}</strong><span>{conversation.messageCount} messages</span></button>)}
    </aside><section className="chat-panel" aria-label="Conversation"><h2>{selected?.title || 'New conversation'}</h2><div className="messages">
      {selected?.messages?.length ? selected.messages.map(message => <article className={`message message--${message.role}`} key={message.id}><h3>{message.role === 'user' ? 'You' : 'Live Desktop'}</h3><p>{message.content}</p></article>) : <EmptyState icon="MessageCircle" title="Start a conversation" detail="Ask about your files, system, or current work." />}
    </div><form className="chat-compose" onSubmit={submit}><label className="visually-hidden" htmlFor="chat-message">Message your assistant</label><textarea id="chat-message" value={value} onChange={event => setValue(event.target.value)} placeholder="Message your assistant" rows={2} /><button className="primary-button" type="submit" disabled={busy || !value.trim()}><Icon name={busy ? 'LoaderCircle' : 'Send'} size={17} />{busy ? 'Sending…' : 'Send'}</button></form>{error ? <p className="form-error" role="alert">{error}</p> : null}</section></div>
  </ViewShell>;
}
