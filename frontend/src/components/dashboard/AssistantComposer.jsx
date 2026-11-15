import { useRef, useState } from 'react';
import { Icon } from '../ui/index.jsx';
// Suggestions only fill the field; nothing is sent until the user presses Send.
const SUGGESTIONS = ['What’s using my memory?', 'Turn off Bluetooth', 'What’s on my calendar today?'];
export function AssistantComposer({ onSubmit, busy }) {
  const [value, setValue] = useState('');
  const sending = useRef(false);
  const input = useRef(null);
  const submit = async event => {
    event.preventDefault();
    if (!value.trim() || busy || sending.current) return;
    sending.current = true;
    const sent = value;
    try { if (await onSubmit(sent.trim())) setValue(current => current === sent ? '' : current); }
    finally { sending.current = false; }
  };
  return <section className="card overview-card overview-card--ask" aria-labelledby="ask-title">
    <h2 id="ask-title">Ask Live Desktop</h2>
    <form className="pill-input assistant-bar" onSubmit={submit}>
      <Icon name="Sparkles" size={18} />
      <input ref={input} value={value} onChange={event => setValue(event.target.value)} placeholder="Ask about your PC, or request an action…" aria-label="Ask your assistant" />
      <button className="btn-round-primary" type="submit" aria-label="Send" disabled={busy || !value.trim()}><Icon name={busy ? 'LoaderCircle' : 'ArrowUp'} size={18} strokeWidth={2.4} className={busy ? 'spin' : ''} /></button>
    </form>
    <div className="chip-row" role="group" aria-label="Suggestions">
      {SUGGESTIONS.map(text => <button key={text} type="button" className="chip" onClick={() => { setValue(text); input.current?.focus(); }}>{text}</button>)}
    </div>
    <p className="inline-caption">Anything that changes your PC asks for approval first. History stays in this local profile; assistant requests are sent to OpenAI.</p>
  </section>;
}
