import { useState } from 'react';
import { Icon } from '../ui/index.jsx';
const APP_ICON_ASSETS = { code: '/assets/app-vscode.svg', figma: '/assets/app-figma.svg' };
function BrandIcon({ app }) {
  if (APP_ICON_ASSETS[app.icon]) {
    return <img className="brand-icon" src={APP_ICON_ASSETS[app.icon]} alt="" />;
  }
  const names = {
    edge: "Globe2",
    chrome: "Chrome",
    excel: "Sheet",
    powerpoint: "Presentation",
    "apple-music": "Music2",
    slack: "MessageSquareMore",
    teams: "UsersRound",
  };
  return (
    <span className={`brand-icon brand-icon--${app.icon || app.id}`}>
      <Icon name={names[app.icon] || "AppWindow"} size={20} />
    </span>
  );
}
export function RecentApps({ apps }) {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const displayApps = apps.map(app => ({ ...app, age: app.running ? "Running" : "Installed" }));
  const visibleApps = showAll ? displayApps : displayApps.slice(0, 4);
  return (
    <section className="activity-column" aria-labelledby="activity-title">
      <div className="column-title-row">
        <h3 id="activity-title">Recent activity</h3>
        <button type="button" className="text-action" onClick={() => setShowAll((value) => !value)}>{showAll ? "Compact" : "View all"}</button>
      </div>
      <div className="app-list">
        {!visibleApps.length ? <p className="app-inline-detail">No supported running apps detected.</p> : null}
        {visibleApps.map((app) => (
          <div className={`app-row-wrap ${selectedId === app.id ? "app-row-wrap--selected" : ""}`} key={app.id}>
            <button className="app-row" type="button" aria-expanded={selectedId === app.id} onClick={() => setSelectedId((value) => value === app.id ? null : app.id)}>
              <BrandIcon app={app} />
              <span>
                <strong>{app.name}</strong>
                <small>{app.detail}</small>
              </span>
              <time>{app.age}</time>
            </button>
            {selectedId === app.id ? <p className="app-inline-detail"><Icon name="Activity" size={14} /> {app.running ? 'Detected from the live Windows process list.' : 'Installed application reported by Windows; not currently running.'}</p> : null}
          </div>
        ))}
      </div>
      <button className="text-action show-more" type="button" onClick={() => setShowAll((value) => !value)}>
        {showAll ? "Show less" : "Show more"} <Icon name={showAll ? "ChevronLeft" : "ChevronRight"} size={15} />
      </button>
    </section>
  );
}
