import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Grid } from '@astryxdesign/core/Grid';
import { VStack } from '@astryxdesign/core/Layout';
import { PerformanceCard } from '../components/dashboard/PerformanceCard.jsx';
import { PcCard } from '../components/dashboard/PcCard.jsx';
import { ConnectionsCard } from '../components/dashboard/ConnectionsCard.jsx';
import { SystemControls } from '../components/dashboard/SystemControls.jsx';
import { RecentApps } from '../components/dashboard/RecentApps.jsx';
import { CalendarPanel } from '../components/dashboard/CalendarPanel.jsx';
import { PhonePanel } from '../components/dashboard/PhonePanel.jsx';
import { SectionHeader } from '../components/dashboard/SectionHeader.jsx';
import { CompactPlayer } from '../components/media/CompactPlayer.jsx';
import { AssistantComposer } from '../components/dashboard/AssistantComposer.jsx';
import { assistantProvider } from '../assistantProviders.js';
import { ResourceBoundary } from '../components/feedback/ResourceBoundary.jsx';
import { Page } from '../components/shell/Page.jsx';

// PC state first (instruments, pending approvals), then this PC and controls, the assistant,
// and connected services. Each service keeps its own ResourceBoundary so loading/stale/error/retry
// render where its content goes.
export function HomeView({ system, systemSeries = [], health, controls, pendingControl, onControl, pendingCount, navigate, apps, calendarProps, phoneProps, mediaProps, onSubmit, busy, states, retry, headerActions }) {
  const boundary = (key, name, children) => <ResourceBoundary name={name} status={states[key]} onRetry={() => retry(key)}>{children}</ResourceBoundary>;
  const ready = Boolean(states.system?.hasData);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return <Page title="Overview" detail={today} actions={headerActions}>
    <VStack gap={8}>
      <VStack gap={4}>
        <ResourceBoundary name="System" status={states.system} onRetry={() => retry('system')} />
        <PerformanceCard system={system} series={systemSeries} ready={ready} />
        {pendingCount ? <Banner status="warning" role="status"
          title={`${pendingCount} ${pendingCount === 1 ? 'request is' : 'requests are'} waiting for your decision.`}
          description="Nothing runs on your PC until you allow it."
          endContent={<Button label="Review requests" onClick={() => navigate('approvals')} />} /> : null}
      </VStack>
      <Grid columns={{ minWidth: 360, max: 2 }} gap={8} align="start">
        <PcCard system={system} ready={ready} onOpenSystem={() => navigate('system')} />
        <SystemControls controls={controls} pendingControl={pendingControl} onControl={onControl} />
      </Grid>
      <AssistantComposer onSubmit={onSubmit} busy={busy} providerName={assistantProvider(health.provider).name} />
      <Grid columns={{ minWidth: 280, max: 3 }} gap={8} align="start">
        {boundary('calendar', 'Calendar', <CalendarPanel {...calendarProps} />)}
        <VStack as="section" gap={2} aria-labelledby="now-playing-title">
          <SectionHeader id="now-playing-title" title="Now playing" />
          {boundary('media', 'Music', <CompactPlayer {...mediaProps} />)}
        </VStack>
        {boundary('phone', 'Phone', <PhonePanel {...phoneProps} />)}
      </Grid>
      <Grid columns={{ minWidth: 360, max: 2 }} gap={8} align="start">
        <ConnectionsCard connected={health.connected} configured={health.configured} providerName={assistantProvider(health.provider).name} calendar={calendarProps.calendar} musicPlayer={mediaProps.musicPlayer} />
        {boundary('apps', 'Applications', <RecentApps apps={apps} />)}
      </Grid>
    </VStack>
  </Page>;
}
