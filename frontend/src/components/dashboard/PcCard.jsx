import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { SectionHeader } from './SectionHeader.jsx';
import { formatBytesPerSec } from '../../presentation/formatters.js';

// Identity comes from Windows; nothing here claims a detected hardware model.
export function PcCard({ system, ready, onOpenSystem }) {
  const r = system.resources;
  const waiting = 'Waiting for system data';
  const networkRates = ready && r.network?.ratesAvailable;
  const diskRates = ready && r.diskActivity?.available;
  const online = ready && r.network?.connected;
  return <VStack as="section" gap={2} aria-labelledby="pc-title">
    <SectionHeader id="pc-title" title="This PC"><Button label="System Info" variant="ghost" size="sm" onClick={onOpenSystem} /></SectionHeader>
    <MetadataList>
      <MetadataListItem label="Name">{ready ? system.host.name : 'Unavailable'}</MetadataListItem>
      <MetadataListItem label="Windows">{ready ? [system.windows?.edition || system.host.os, system.host.architecture].filter(Boolean).join(', ') : waiting}</MetadataListItem>
      <MetadataListItem label="Network">{ready
        ? <HStack gap={2} vAlign="center"><StatusDot variant={online ? 'success' : 'warning'} label={online ? 'Connected' : 'Offline'} /><Text>{online ? `${r.network.name || 'Network'} connected` : 'Offline'}</Text></HStack>
        : 'Unavailable'}</MetadataListItem>
      <MetadataListItem label="Throughput">{networkRates ? `${formatBytesPerSec(r.network.rxBytesPerSec)} down, ${formatBytesPerSec(r.network.txBytesPerSec)} up` : ready ? 'Rates unavailable' : waiting}</MetadataListItem>
      <MetadataListItem label="Disk activity">{diskRates ? `${formatBytesPerSec(r.diskActivity.readBytesPerSec)} read, ${formatBytesPerSec(r.diskActivity.writeBytesPerSec)} write` : ready ? 'Activity unavailable' : waiting}</MetadataListItem>
      <MetadataListItem label="Battery">{ready && r.battery?.available && r.battery.percent != null ? `${r.battery.percent}%` : 'Not reported'}</MetadataListItem>
    </MetadataList>
  </VStack>;
}
