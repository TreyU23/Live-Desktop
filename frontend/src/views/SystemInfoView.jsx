import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Grid } from '@astryxdesign/core/Grid';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Table } from '@astryxdesign/core/Table';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Page } from '../components/shell/Page.jsx';
import { Sparkline } from '../components/instruments/Sparkline.jsx';
import { icons } from '../components/ui/icons.js';
import { formatBytes, formatBytesPerSec, percent, formatInstalledDate } from '../presentation/formatters.js';
import { utilizationSeverity } from '../presentation/utilizationSeverity.js';

const kBarVariant = { normal: 'success', elevated: 'warning', critical: 'error' };
const shown = value => (value == null || value === '' ? 'Unavailable' : value);

// One utilization row: name and percent, a severity-colored bar, and the detail line.
// A missing reading is said to be unavailable and draws no bar, never a zero.
function ResourceRow({ label, value, detail }) {
  const available = Number.isFinite(value) && value >= 0 && value <= 100;
  const severity = available ? utilizationSeverity(value) : null;
  return <VStack gap={2} paddingBlock={3}>
    <HStack gap={3} vAlign="center">
      <StackItem size="fill"><Text weight="medium">{label}</Text></StackItem>
      <Text weight="medium">{available ? `${Math.round(value)}%` : '—'}</Text>
    </HStack>
    {available ? <ProgressBar label={`${label} utilization`} isLabelHidden value={value} variant={kBarVariant[severity]} /> : null}
    <Text type="supporting">{available ? detail : value == null ? 'Reading unavailable' : `Invalid reading: ${value}`}</Text>
  </VStack>;
}

function SectionHeading({ id, title, children }) {
  return <HStack gap={3} vAlign="center">
    <StackItem size="fill"><Heading level={2} id={id}>{title}</Heading></StackItem>
    {children}
  </HStack>;
}

export function SystemInfoView({ system, series = [], connected, configured, onCopy, headerActions }) {
  const [tab, setTab] = useState('live');
  const [showIds, setShowIds] = useState(false);
  const seriesValues = key => series.map(sample => sample[key]);
  const resources = system.resources;
  const device = system.device || {};
  const windows = system.windows || {};
  const network = resources.network || {};
  const disk = resources.diskActivity || {};
  const battery = resources.battery || {};
  const graphics = device.graphics?.length ? device.graphics : [{ name: 'Unavailable', driverVersion: 'Unavailable' }];
  const memoryPercent = percent(resources.memoryUsedBytes, resources.memoryTotalBytes);
  const storagePercent = percent(resources.storageUsedBytes, resources.storageTotalBytes);
  const processorDetail = [
    device.processorCores ? `${device.processorCores} cores` : null,
    device.processorLogicalProcessors ? `${device.processorLogicalProcessors} logical processors` : null,
    device.maxClockMhz ? `${(device.maxClockMhz / 1000).toFixed(2)} GHz max` : null,
  ].filter(Boolean).join(', ') || 'Windows processor information unavailable';

  const activity = [
    { id: 'net-down', source: 'Network down', now: network.ratesAvailable ? formatBytesPerSec(network.rxBytesPerSec) : 'Unavailable', trend: 'netRx' },
    { id: 'net-up', source: 'Network up', now: network.ratesAvailable ? formatBytesPerSec(network.txBytesPerSec) : 'Unavailable', trend: 'netTx' },
    { id: 'disk-read', source: 'Disk read', now: disk.available ? formatBytesPerSec(disk.readBytesPerSec) : 'Unavailable', trend: 'diskRead' },
    { id: 'disk-write', source: 'Disk write', now: disk.available ? formatBytesPerSec(disk.writeBytesPerSec) : 'Unavailable', trend: 'diskWrite' },
    { id: 'battery', source: 'Battery', now: battery.available ? `${battery.percent}%` : 'Not reported', trend: null, detail: battery.detail },
  ];
  const activityColumns = [
    { key: 'source', header: 'Source' },
    { key: 'now', header: 'Now' },
    { key: 'trend', header: 'Last 15 minutes', renderCell: row => row.trend
      ? <Sparkline values={seriesValues(row.trend)} label={`${row.source} trend`} />
      : <Text type="supporting">{row.detail || 'No readings'}</Text> },
  ];

  const ids = showIds
    ? [<MetadataListItem key="device-id" label="Device ID"><Text type="code">{shown(device.deviceId)}</Text></MetadataListItem>,
      <MetadataListItem key="product-id" label="Product ID"><Text type="code">{shown(device.productId)}</Text></MetadataListItem>]
    : [<MetadataListItem key="device-id" label="Device ID"><Text type="supporting">Hidden</Text></MetadataListItem>,
      <MetadataListItem key="product-id" label="Product ID"><Text type="supporting">Hidden</Text></MetadataListItem>];
  const showIdsButton = <Button label={showIds ? 'Hide IDs' : 'Show IDs'} size="sm" aria-pressed={showIds} onClick={() => setShowIds(value => !value)} />;

  const deviceSection = full => <VStack as="section" gap={2} aria-labelledby="system-device-title">
    <SectionHeading id="system-device-title" title="Device">{showIdsButton}</SectionHeading>
    <MetadataList>
      <MetadataListItem label="Device name">{shown(system.host.name)}</MetadataListItem>
      {full ? <MetadataListItem label="Manufacturer">{shown(device.manufacturer)}</MetadataListItem> : null}
      {full ? <MetadataListItem label="Model">{shown(device.model)}</MetadataListItem> : null}
      <MetadataListItem label="Processor">{shown(device.processorName)}</MetadataListItem>
      <MetadataListItem label="Installed RAM">{formatBytes(device.installedMemoryBytes || resources.memoryTotalBytes)}</MetadataListItem>
      {full ? <MetadataListItem label="Graphics">{graphics.map(item => item.name).join(', ')}</MetadataListItem> : null}
      <MetadataListItem label="System type">{shown(device.systemType)}</MetadataListItem>
      {ids}
    </MetadataList>
  </VStack>;
  const windowsSection = full => <VStack as="section" gap={2} aria-labelledby="system-windows-title">
    <SectionHeading id="system-windows-title" title="Windows" />
    <MetadataList>
      <MetadataListItem label="Edition">{shown(windows.edition)}</MetadataListItem>
      <MetadataListItem label="Version">{shown(windows.version)}</MetadataListItem>
      <MetadataListItem label="OS build">{shown(windows.build)}</MetadataListItem>
      <MetadataListItem label="Installed on">{formatInstalledDate(windows.installedOn)}</MetadataListItem>
      {full ? <MetadataListItem label="OS version">{shown(windows.osVersion)}</MetadataListItem> : null}
      {full ? <MetadataListItem label="Architecture">{shown(windows.architecture)}</MetadataListItem> : null}
    </MetadataList>
  </VStack>;

  return <Page title="System Info" detail="Live readings and device specifications." actions={headerActions}
    status={<HStack gap={2} vAlign="center"><StatusDot variant={connected ? 'success' : 'warning'} label={connected ? 'Live Windows data' : 'Backend unavailable'} />
      <Text type="supporting">{connected ? 'Live Windows data' : 'Backend unavailable'}</Text></HStack>}>
    <VStack gap={6}>
      <HStack gap={3} vAlign="center" wrap="wrap">
        <StackItem size="fill">
          <SegmentedControl label="System information" value={tab} onChange={setTab}>
            <SegmentedControlItem value="live" label="Live" />
            <SegmentedControlItem value="specs" label="Specifications" />
          </SegmentedControl>
        </StackItem>
        <Button label="Copy specifications" icon={<Icon icon={icons.Copy} />} onClick={onCopy} />
      </HStack>

      {tab === 'live' ? <Grid columns={{ minWidth: 400, max: 2 }} gap={8} align="start">
        <VStack gap={6}>
          <VStack as="section" gap={0} aria-labelledby="system-resources-title">
            <SectionHeading id="system-resources-title" title="Resources" />
            <ResourceRow label="CPU" value={resources.cpuPercent} detail={processorDetail} />
            <ResourceRow label="Memory" value={memoryPercent} detail={`${formatBytes(resources.memoryUsedBytes)} of ${formatBytes(resources.memoryTotalBytes)} in use`} />
            <ResourceRow label="Storage" value={storagePercent} detail={`${formatBytes(resources.storageUsedBytes)} of ${formatBytes(resources.storageTotalBytes)} in use`} />
          </VStack>
          <VStack as="section" gap={2} aria-labelledby="system-activity-title">
            <SectionHeading id="system-activity-title" title="Activity" />
            <Table data={activity} columns={activityColumns} idKey="id" verticalAlign="middle" density="compact" />
          </VStack>
        </VStack>
        <VStack gap={6}>
          {deviceSection(false)}
          {windowsSection(false)}
        </VStack>
      </Grid> : <Grid columns={{ minWidth: 400, max: 2 }} gap={8} align="start">
        {deviceSection(true)}
        {windowsSection(true)}
        <VStack as="section" gap={2} aria-labelledby="system-status-title">
          <SectionHeading id="system-status-title" title="Live system status" />
          <MetadataList>
            <MetadataListItem label="Network">{network.connected ? `${shown(network.name)}, ${shown(network.address)}` : 'Offline'}</MetadataListItem>
            <MetadataListItem label="Battery">{battery.available ? `${battery.percent}%, ${battery.detail}` : shown(battery.detail)}</MetadataListItem>
            <MetadataListItem label="Backend">{connected ? 'Local API connected' : 'Unavailable'}</MetadataListItem>
            <MetadataListItem label="OpenAI">{configured ? 'Key configured' : 'API key needed'}</MetadataListItem>
            <MetadataListItem label="Java runtime">{system.host.javaVersion ? `Java ${system.host.javaVersion}` : 'Unavailable'}</MetadataListItem>
            <MetadataListItem label="Last refreshed">{system.capturedAt ? new Date(system.capturedAt).toLocaleString() : 'Not yet received'}</MetadataListItem>
          </MetadataList>
        </VStack>
      </Grid>}

      <HStack gap={2} vAlign="center">
        <Icon icon={icons.Shield} size="sm" color="secondary" />
        <Text type="supporting">Read locally from Windows, the Java runtime and the workspace drive. No administrator access is requested.</Text>
      </HStack>
    </VStack>
  </Page>;
}
