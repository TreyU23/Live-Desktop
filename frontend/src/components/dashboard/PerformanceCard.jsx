import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Heading, Text } from '@astryxdesign/core/Text';
import { ResourceGauge } from '../instruments/ResourceGauge.jsx';
import { Sparkline } from '../instruments/Sparkline.jsx';
import { formatBytes } from '../../presentation/formatters.js';
import { utilizationSeverity } from '../../presentation/utilizationSeverity.js';

// Severity thresholds stay <75 / 75–89 / ≥90 (utilizationSeverity); the label says it in words too.
const kSeverity = {
  normal: { variant: 'success', label: 'Normal' },
  elevated: { variant: 'warning', label: 'High' },
  critical: { variant: 'error', label: 'Critical' },
};

function InstrumentTile({ title, label, value, detail, series }) {
  const severity = Number.isFinite(value) ? kSeverity[utilizationSeverity(value)] : null;
  const state = severity || { variant: 'neutral', label: 'Unavailable' };
  return <Card padding={4}>
    <VStack gap={2} hAlign="center">
      <HStack gap={2} vAlign="center" width="100%">
        <StackItem size="fill"><Heading level={2}>{title}</Heading></StackItem>
        <HStack gap={2} vAlign="center"><StatusDot variant={state.variant} label={state.label} /><Text>{state.label}</Text></HStack>
      </HStack>
      <ResourceGauge label={label} value={value} />
      <Text type="supporting">{detail}</Text>
      <Sparkline values={series} label={`${title} trend`} severity={severity ? utilizationSeverity(value) : null} />
      <Text type="supporting">Last 15 minutes</Text>
    </VStack>
  </Card>;
}

// The three instrument tiles: the only Cards on Overview.
export function PerformanceCard({ system, ready, series = [] }) {
  const r = system.resources;
  const ratio = (used, total) => ready && Number.isFinite(used) && total > 0 ? used / total * 100 : null;
  const seriesValues = key => series.map(sample => sample[key]);
  const waiting = 'Waiting for system data';
  return <Grid columns={{ minWidth: 220, max: 3 }} gap={4} aria-label="Performance">
    <InstrumentTile title="CPU" label="CPU load" value={ready ? r.cpuPercent : null}
      detail={ready ? 'Current utilization' : waiting} series={seriesValues('cpu')} />
    <InstrumentTile title="Memory" label="Memory used" value={ratio(r.memoryUsedBytes, r.memoryTotalBytes)}
      detail={ready && r.memoryTotalBytes > 0 ? `${formatBytes(r.memoryUsedBytes)} of ${formatBytes(r.memoryTotalBytes)}` : ready ? 'Memory unavailable' : waiting} series={seriesValues('memory')} />
    <InstrumentTile title="Storage" label="Storage used" value={ratio(r.storageUsedBytes, r.storageTotalBytes)}
      detail={ready && r.storageTotalBytes > 0 ? `${formatBytes(r.storageUsedBytes)} of ${formatBytes(r.storageTotalBytes)}` : ready ? 'Storage unavailable' : waiting} series={seriesValues('storage')} />
  </Grid>;
}
