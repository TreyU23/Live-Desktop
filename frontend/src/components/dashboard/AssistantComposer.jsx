import { useRef, useState } from 'react';
import { Icon } from '../ui/index.jsx';
export function AssistantComposer({ onSubmit, busy }) {
  const [value, setValue] = useState('');
  const sending = useRef(false);
  const submit = async event => {
    event.preventDefault();
    if (!value.trim() || busy || sending.current) return;
    sending.current = true;
    const sent = value;
    try { if (await onSubmit(sent.trim())) setValue(current => current === sent ? '' : current); }
    finally { sending.current = false; }
  };
  return <form className="assistant-bar" onSubmit={submit}><Icon name="MessageCircle" size={20} />
    <input value={value} onChange={event => setValue(event.target.value)} placeholder="Ask about your PC, files or current work…" aria-label="Ask your assistant" />
    <button className="primary-button" type="submit" disabled={busy || !value.trim()}><Icon name={busy ? 'LoaderCircle' : 'Send'} size={17} />{busy ? 'Sending…' : 'Send'}</button>
  </form>;
}
