export function ConnectionsCard({ connected, configured, calendar, musicPlayer }) {
  const rows = [
    { name: 'Local API', state: connected ? 'Available' : 'Unavailable', tone: connected ? 'good' : 'error' },
    { name: 'iCloud', state: calendar.connected ? calendar.status === 'error' ? 'Sync error' : 'Connected' : 'Not connected', tone: calendar.connected ? calendar.status === 'error' ? 'warn' : 'good' : null },
    { name: 'OpenAI key', state: configured ? 'Configured' : 'Not set', tone: configured ? 'good' : 'warn' },
    { name: 'Music', state: musicPlayer.available ? musicPlayer.playing ? 'Playing' : 'Session available' : 'Idle', tone: musicPlayer.available ? 'good' : null },
  ];
  return <section className="card overview-card overview-card--connections" aria-labelledby="connections-title">
    <h2 id="connections-title">Connections</h2>
    <div className="group group--plain">
      {rows.map(row => <div key={row.name}><i className={`status-dot ${row.tone ? `status-dot--${row.tone}` : ''}`} aria-hidden="true" /><span className="group__value">{row.name}</span><span className="muted">{row.state}</span></div>)}
    </div>
  </section>;
}
