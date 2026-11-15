import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/index.jsx';
import { actionDetails } from '../../presentation/actionDetails.js';

const KIND_ICON = { windows_set_control: 'Settings', windows_open_uri: 'ExternalLink', browser_open_url: 'Globe2', workspace_write_file: 'Clipboard', remember: 'Bookmark' };
const CONTROL_ICON = { wifi: 'Wifi', bluetooth: 'Bluetooth' };

// Modal queue of pending actions. The backend has no one-shot approval: approving makes the scope
// reusable, so the sheet states that instead of offering a switch it cannot honor.
export function ApprovalSheet({ actions, onApprove, onReject, onClose, returnFocus }) {
  const dialog = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [index, setIndex] = useState(0);
  const action = actions[Math.min(index, actions.length - 1)];
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    element.querySelector('.approval-sheet__actions button')?.focus();
    return () => { element.close(); (returnFocus?.() || null)?.focus?.(); };
  }, []);
  useEffect(() => { if (!action) onClose(); }, [action]);
  if (!action) return <dialog ref={dialog} className="approval-sheet card--strong" aria-label="Approval request" />;
  const details = actionDetails(action);
  const position = Math.min(index, actions.length - 1);
  const decide = async verb => {
    if (submitting) return;
    setSubmitting(true);
    try { await (verb === 'approve' ? onApprove : onReject)(action.id); }
    finally { setSubmitting(false); }
  };
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first = focusable[0]; const last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const icon = action.kind === 'windows_set_control' ? CONTROL_ICON[action.arguments?.control] || 'Settings' : KIND_ICON[action.kind] || 'Shield';
  return <dialog ref={dialog} className="approval-sheet card--strong" aria-labelledby="approval-sheet-title" aria-describedby="approval-sheet-reason"
    onKeyDown={trapFocus} onCancel={event => { event.preventDefault(); if (!submitting) onClose(); }}>
    <div className="approval-sheet__queue">
      {actions.length > 1 ? <>
        <button type="button" className="btn-icon btn-icon--plain" aria-label="Previous request" disabled={position === 0 || submitting} onClick={() => setIndex(position - 1)}><Icon name="ChevronLeft" size={16} /></button>
        <span role="status">{position + 1} of {actions.length}</span>
        <button type="button" className="btn-icon btn-icon--plain" aria-label="Next request" disabled={position === actions.length - 1 || submitting} onClick={() => setIndex(position + 1)}><Icon name="ChevronRight" size={16} /></button>
      </> : <span>1 of 1</span>}
    </div>
    <span className="tile tile--48 tile--accent" aria-hidden="true"><Icon name={icon} size={26} strokeWidth={2} /></span>
    <h2 id="approval-sheet-title">{details.title}?</h2>
    <p id="approval-sheet-reason">{action.reason}</p>
    <dl className="group">
      <div><dt>Action</dt><dd>{details.operation}{details.target ? <> · <span className="data-value">{details.target}</span></> : null}</dd></div>
      <div><dt>How</dt><dd>{details.how}</dd></div>
      <div><dt>Requested</dt><dd>{action.createdAt ? new Date(action.createdAt).toLocaleString() : 'Time not recorded'}</dd></div>
    </dl>
    {details.content != null ? <pre className="action-content well" tabIndex={0} aria-label="Action content">{String(details.content)}</pre> : null}
    <p className="scope-notice"><Icon name="Info" size={16} /><span><strong>Allowing also allows matching requests later.</strong> {details.scope} An execution failure does not revoke that approval.</span></p>
    <div className="approval-sheet__actions">
      <button type="button" disabled={submitting} onClick={() => decide('reject')}>Don’t Allow</button>
      <button type="button" className="btn-primary" disabled={submitting || details.unsupported} onClick={() => decide('approve')}>{submitting ? 'Submitting…' : 'Allow'}</button>
    </div>
    <button type="button" className="text-action approval-sheet__later" onClick={onClose} disabled={submitting}>Decide later</button>
  </dialog>;
}
