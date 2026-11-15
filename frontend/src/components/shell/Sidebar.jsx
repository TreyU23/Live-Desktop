import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/index.jsx';

// Seven view ids are part of the product contract. Tile colors are fixed (not accent-derived)
// so navigation stays legible whatever accent the profile picks.
export const NAV_ITEMS = [
  { id: 'home', label: 'Overview', icon: 'House', group: 'Desktop', tileColor: '#0A84FF', primary: true },
  { id: 'system', label: 'System Info', icon: 'Monitor', group: 'Desktop', tileColor: '#636366', primary: true },
  { id: 'conversations', label: 'Conversations', icon: 'MessagesSquare', group: 'Assistant', tileColor: '#30A14E', primary: true },
  { id: 'approvals', label: 'Approvals', icon: 'Shield', group: 'Assistant', tileColor: '#C66A00' },
  { id: 'memories', label: 'Memories', icon: 'Bookmark', group: 'Assistant', tileColor: '#8E44C9' },
  { id: 'music', label: 'Music', icon: 'Music2', group: 'Media', tileColor: '#E0284A' },
  { id: 'settings', label: 'Settings', icon: 'Settings', group: 'Live Desktop', tileColor: '#636366' },
];
const GROUPS = ['Desktop', 'Assistant', 'Media', 'Live Desktop'];

function NavTile({ entry }) {
  return <span className="tile" style={{ '--tile-color': entry.tileColor }} aria-hidden="true"><Icon name={entry.icon} size={15} strokeWidth={2.2} /></span>;
}

export function Sidebar({ activeView, onNavigate, pendingCount, hostName, connected, profileSlot }) {
  const [query, setQuery] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRoot = useRef(null);
  const moreTrigger = useRef(null);
  useEffect(() => {
    if (!moreOpen) return;
    const close = event => {
      if (event.type === 'keydown' && event.key === 'Escape') { setMoreOpen(false); moreTrigger.current?.focus(); }
      else if (event.type === 'pointerdown' && !moreRoot.current?.contains(event.target)) setMoreOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [moreOpen]);

  const select = id => { setMoreOpen(false); setQuery(''); onNavigate(id); };
  // Search filters navigation labels on this page only; it never reaches the backend.
  const needle = query.trim().toLowerCase();
  const matches = NAV_ITEMS.filter(entry => !needle || entry.label.toLowerCase().includes(needle));
  const badge = id => id === 'approvals' && pendingCount ? <span className="badge">{pendingCount}<span className="visually-hidden"> pending</span></span> : null;
  const item = (entry, extraClass = '') => <button type="button" key={entry.id} className={`sidebar__item ${extraClass}`.trim()}
    aria-current={activeView === entry.id ? 'page' : undefined} onClick={() => select(entry.id)}>
    <NavTile entry={entry} /><span>{entry.label}</span>{badge(entry.id)}
  </button>;
  const secondary = NAV_ITEMS.filter(entry => !entry.primary);
  const secondaryActive = secondary.some(entry => entry.id === activeView);

  return <nav className="sidebar" aria-label="Primary navigation">
    <button type="button" className="sidebar__brand" onClick={() => select('home')}>
      <span className="app-logo" aria-hidden="true"><Icon name="Zap" size={18} strokeWidth={2.2} /></span>
      <span><strong>Live Desktop</strong><small>{hostName} · {connected ? 'Local mode' : 'Backend offline'}</small></span>
    </button>
    <form className="pill-input sidebar__search" role="search" onSubmit={event => { event.preventDefault(); if (matches[0]) select(matches[0].id); }}>
      <Icon name="Search" size={14} />
      <label className="visually-hidden" htmlFor="sidebar-search">Find a page</label>
      <input id="sidebar-search" type="search" placeholder="Search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} />
    </form>
    <div className="sidebar__sections">
      {GROUPS.map(group => {
        const entries = matches.filter(entry => entry.group === group);
        if (!entries.length) return null;
        return <div className="sidebar__section" key={group}><h2>{group}</h2>{entries.map(entry => item(entry, entry.primary ? 'sidebar__item--primary' : 'sidebar__item--secondary'))}</div>;
      })}
      {!matches.length ? <p className="sidebar__empty" role="status">No pages match “{query}”.</p> : null}
    </div>
    <div className="sidebar__more" ref={moreRoot}>
      <button ref={moreTrigger} type="button" aria-expanded={moreOpen} aria-controls="more-destinations" data-active={secondaryActive} onClick={() => setMoreOpen(value => !value)}>
        <span className="tile" style={{ '--tile-color': '#48484A' }} aria-hidden="true"><Icon name="PanelsTopLeft" size={15} strokeWidth={2.2} /></span><span>More</span>{pendingCount ? <span className="badge">{pendingCount}<span className="visually-hidden"> pending approvals</span></span> : null}
      </button>
      {moreOpen ? <div id="more-destinations" className="more-destinations card--strong" aria-label="More destinations">{secondary.map(entry => item(entry))}</div> : null}
    </div>
    <div className="sidebar__footer">{profileSlot}</div>
  </nav>;
}
