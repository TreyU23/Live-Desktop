import { SystemOverview } from '../components/dashboard/SystemOverview.jsx';
import { SystemControls } from '../components/dashboard/SystemControls.jsx';
import { RecentApps } from '../components/dashboard/RecentApps.jsx';
import { CalendarPanel } from '../components/dashboard/CalendarPanel.jsx';
import { PhonePanel } from '../components/dashboard/PhonePanel.jsx';
import { CompactPlayer } from '../components/media/CompactPlayer.jsx';
import { AssistantComposer } from '../components/dashboard/AssistantComposer.jsx';
import { ResourceBoundary } from '../components/feedback/ResourceBoundary.jsx';
export function HomeView({ system, health, controls, pendingControl, onControl, pendingCount, navigate, apps, calendarProps, phoneProps, mediaProps, onSubmit, busy, states, retry }) {
  const boundary = (key, name, children) => <ResourceBoundary name={name} status={states[key]} onRetry={() => retry(key)}>{children}</ResourceBoundary>;
  return <main className="home-view">
    <header className="page-heading"><div><h1 tabIndex={-1}>System overview</h1><p>The whole PC, understood at a glance.</p></div><time>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</time></header>
    <div className="overview-layout">
      <SystemOverview system={system} ready={Boolean(states.system?.hasData)} connected={health.connected} configured={health.configured} calendar={calendarProps.calendar} musicPlayer={mediaProps.musicPlayer} onOpenSystem={() => navigate('system')} />
      <SystemControls controls={controls} pendingControl={pendingControl} onControl={onControl} onApprovals={() => navigate('approvals')} pendingCount={pendingCount} />
      <div className="service-rail">
        {boundary('calendar', 'Calendar', <CalendarPanel {...calendarProps} />)}
        {boundary('phone', 'Phone', <PhonePanel {...phoneProps} />)}
        {boundary('media', 'Music', <CompactPlayer {...mediaProps} />)}
      </div>
    </div>
    <ResourceBoundary name="System" status={states.system} onRetry={() => retry('system')} />
    {boundary('apps', 'Applications', <RecentApps apps={apps} />)}
    <AssistantComposer onSubmit={onSubmit} busy={busy} />
    <p className="privacy-note">Local profile history. Assistant requests are sent to OpenAI.</p>
  </main>;
}
