import { useEffect, useRef } from 'react';
export function ConfirmDialog({ title, children, confirmLabel, onCancel, onConfirm, busy = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    element.querySelector('button')?.focus();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]')];
    const first = buttons[0]; const last = buttons.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <dialog className="confirm-dialog" ref={dialog} aria-labelledby="confirmation-title" onKeyDown={trapFocus} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="confirmation-title">{title}</h2><div className="confirmation-content">{children}</div>
    <div className="dialog-actions"><button type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="danger-button" type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Submitting…' : confirmLabel}</button></div>
  </dialog>;
}
