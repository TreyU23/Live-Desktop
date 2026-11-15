import { useState } from 'react';
import { Icon, EmptyState, ViewShell } from '../components/ui/index.jsx';
import { actionDetails } from '../presentation/actionDetails.js';

// Queue and history. Conversations shows the same pending queue as a sheet.
export function ApprovalsView({ actions, onApprove, onReject, headerActions }) {
  const [filter, setFilter] = useState('pending');
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const visible = actions.filter(action => filter === 'pending' ? action.status === 'pending' : action.status !== 'pending');
  const selected = visible.find(action => action.id === selectedId) || visible[0];
  const details = selected ? actionDetails(selected) : null;
  const decide = async verb => {
    if (submitting) return;
    setSubmitting(selected.id);
    try { await (verb === 'approve' ? onApprove : onReject)(selected.id); } finally { setSubmitting(null); }
  };
  return <ViewShell title="Approvals" detail="Inspect an action and the access it grants before deciding." actions={headerActions}>
    <div className="view-toolbar"><div className="segmented" aria-label="Approval filter" role="group"><button type="button" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Pending ({actions.filter(action => action.status === 'pending').length})</button><button type="button" aria-pressed={filter === 'history'} onClick={() => setFilter('history')}>History</button></div><span className="muted">Current local profile</span></div>
    <div className="approval-workspace">
      <aside className="card approval-list" aria-label="Action queue">
        {visible.length ? <div className="group">{visible.map(action => <button className={`approval-row ${selected?.id === action.id ? 'selected' : ''}`} key={action.id} type="button" aria-pressed={selected?.id === action.id} onClick={() => setSelectedId(action.id)}><Icon name="Shield" size={18} /><span><strong>{action.reason}</strong><small>{action.kind.replaceAll('_', ' ')}</small></span><span className={`state-pill state-pill--${action.status}`}>{action.status}</span></button>)}</div> : null}
        {!visible.length ? <EmptyState icon="Shield" title={filter === 'pending' ? 'Nothing needs review' : 'No action history'} detail="New assistant and system actions appear here." /> : null}
      </aside>
      {selected ? <article className="card action-detail" aria-label="Selected action details">
        <h2>{details.title}</h2><p>{selected.reason}</p>
        <dl className="group">
          <div><dt>Operation</dt><dd>{details.operation}</dd></div>
          <div><dt>How</dt><dd>{details.how}</dd></div>
          <div><dt>Target</dt><dd className="data-value">{details.target || 'Not supplied'}</dd></div>
          <div><dt>Reusable approval scope</dt><dd>{details.scope}</dd></div>
        </dl>
        <p className="scope-notice"><Icon name="Info" size={16} /><span>Approving permits later matching actions to run immediately. An execution failure does not revoke that approval.</span></p>
        {details.content != null ? <section><h3>Full content</h3><pre className="action-content well" tabIndex={0} aria-label="Action content">{String(details.content)}</pre></section> : null}
        <p className={`state-pill state-pill--${selected.status}`} role="status">{submitting === selected.id ? 'Submitting…' : selected.status}</p>
        {selected.error ? <p className="form-error">{selected.error}</p> : null}
        {selected.result != null ? <details><summary>Execution result</summary><pre className="action-content well">{typeof selected.result === 'string' ? selected.result : JSON.stringify(selected.result, null, 2)}</pre></details> : null}
        <p className="muted">Requested {new Date(selected.createdAt).toLocaleString()}{selected.updatedAt ? ` · Updated ${new Date(selected.updatedAt).toLocaleString()}` : ''}</p>
        {selected.status === 'pending' ? <div className="decision-actions"><button type="button" disabled={Boolean(submitting)} onClick={() => decide('reject')}>Reject</button><button className="btn-primary" type="button" disabled={Boolean(submitting) || details.unsupported} onClick={() => decide('approve')}>Approve capability</button></div> : null}
      </article> : null}
    </div>
  </ViewShell>;
}
