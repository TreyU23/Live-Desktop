import { PerformanceCard } from '../components/dashboard/PerformanceCard.jsx';
import { PcCard } from '../components/dashboard/PcCard.jsx';
import { ConnectionsCard } from '../components/dashboard/ConnectionsCard.jsx';
import { SystemControls } from '../components/dashboard/SystemControls.jsx';
import { RecentApps } from '../components/dashboard/RecentApps.jsx';
import { CalendarPanel } from '../components/dashboard/CalendarPanel.jsx';
import { PhonePanel } from '../components/dashboard/PhonePanel.jsx';
import { CompactPlayer } from '../components/media/CompactPlayer.jsx';
import { AssistantComposer } from '../components/dashboard/AssistantComposer.jsx';
import { ResourceBoundary } from '../components/feedback/ResourceBoundary.jsx';
import { Page } from '../components/shell/Page.jsx';

// Widget grid. Each service keeps its own ResourceBoundary so loading/stale/error/retry render in its card.
export function HomeView({ system, systemSeries = [], health, controls, pendingControl, onControl, pendingCount, navigate, apps, calendarProps, phoneProps, mediaProps, onSubmit, busy, states, retry, headerActions }) {
  const boundary = (key, name, children) => <ResourceBoundary name={name} status={states[key]} onRetry={() => retry(key)}>{children}</ResourceBoundary>;
  const ready = Boolean(states.system?.hasData);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return <Page title="Overview" detail={today} actions={headerActions}><div className="legacy home-view">
    <ResourceBoundary name="System" status={states.system} onRetry={() => retry('system')} />
    <div className="overview-grid">
      <PerformanceCard system={system} series={systemSeries} ready={ready} onOpenSystem={() => navigate('system')} />
      <PcCard system={system} ready={ready} onOpenSystem={() => navigate('system')} />
      <SystemControls controls={controls} pendingControl={pendingControl} onControl={onControl} onApprovals={() => navigate('approvals')} pendingCount={pendingCount} />
      {boundary('calendar', 'Calendar', <CalendarPanel {...calendarProps} />)}
      <section className="card overview-card overview-card--media" aria-labelledby="now-playing-title"><h2 id="now-playing-title">Now Playing</h2>{boundary('media', 'Music', <CompactPlayer {...mediaProps} />)}</section>
      <AssistantComposer onSubmit={onSubmit} busy={busy} />
      {boundary('phone', 'Phone', <PhonePanel {...phoneProps} />)}
      <ConnectionsCard connected={health.connected} configured={health.configured} calendar={calendarProps.calendar} musicPlayer={mediaProps.musicPlayer} />
      {boundary('apps', 'Applications', <RecentApps apps={apps} />)}
    </div>
  </div></Page>;
}
