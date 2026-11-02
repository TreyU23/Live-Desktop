import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/index.jsx';
export const NAV_ITEMS = [
  { id: 'home', label: 'Overview', icon: 'House' }, { id: 'system', label: 'System Info', icon: 'Monitor' },
  { id: 'music', label: 'Music', icon: 'Music2' }, { id: 'approvals', label: 'Approvals', icon: 'Shield' },
  { id: 'memories', label: 'Memories', icon: 'Bookmark' }, { id: 'conversations', label: 'Conversations', icon: 'MessagesSquare' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];
export function NavigationDock({ activeView, onNavigate, pendingCount }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const secondary = ['music', 'approvals', 'memories', 'settings'];
  useEffect(() => {
    if (!open) return;
    const close = event => {
      if (event.type === 'keydown' && event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
      else if (event.type === 'pointerdown' && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [open]);
  const select = id => { setOpen(false); onNavigate(id); };
  const item = (entry, extra = '') => <button type="button" key={entry.id} aria-label={entry.label} className={`${activeView === entry.id ? 'active' : ''} ${extra}`} aria-current={activeView === entry.id ? 'page' : undefined} onClick={() => select(entry.id)}><Icon name={entry.icon} size={18} /><span>{entry.label}</span>{entry.id === 'approvals' && pendingCount ? <b aria-label={`${pendingCount} pending approvals`}>{pendingCount}</b> : null}</button>;
  return <nav className="navigation-dock" aria-label="Primary navigation" ref={root}>
    {NAV_ITEMS.map(entry => item(entry, secondary.includes(entry.id) ? 'dock-secondary' : 'dock-primary'))}
    <div className="more-navigation"><button ref={trigger} type="button" aria-label="More" aria-expanded={open} aria-controls="more-destinations" className={secondary.includes(activeView) ? 'active' : ''} onClick={() => setOpen(value => !value)}><Icon name="PanelsTopLeft" size={18} /><span>More</span>{pendingCount ? <b aria-label={`${pendingCount} pending approvals`}>{pendingCount}</b> : null}</button>
      {open ? <div id="more-destinations" className="more-destinations" aria-label="More destinations">{NAV_ITEMS.filter(entry => secondary.includes(entry.id)).map(entry => item(entry))}</div> : null}
    </div>
  </nav>;
}
