import { HStack, VStack } from '@astryxdesign/core/Layout';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { SectionHeader } from './SectionHeader.jsx';

export function ConnectionsCard({ connected, configured, providerName = 'OpenAI', calendar, musicPlayer }) {
  const rows = [
    { id: 'api', service: 'Local API', state: connected ? 'Available' : 'Unavailable', tone: connected ? 'success' : 'error' },
    { id: 'icloud', service: 'iCloud Calendar', state: calendar.connected ? calendar.status === 'error' ? 'Sync error' : 'Connected' : 'Not connected', tone: calendar.connected ? calendar.status === 'error' ? 'warning' : 'success' : 'neutral' },
    { id: 'assistant', service: `${providerName} key`, state: configured ? 'Configured' : 'Not set', tone: configured ? 'success' : 'warning' },
    { id: 'music', service: 'Music', state: musicPlayer.available ? musicPlayer.playing ? 'Playing' : 'Session available' : 'Idle', tone: musicPlayer.available ? 'success' : 'neutral' },
  ];
  const columns = [
    { key: 'service', header: 'Service' },
    { key: 'state', header: 'State', renderCell: row => <HStack gap={2} vAlign="center"><StatusDot variant={row.tone} label={row.state} /><Text>{row.state}</Text></HStack> },
  ];
  return <VStack as="section" gap={2} aria-labelledby="connections-title">
    <SectionHeader id="connections-title" title="Connections" />
    <Table data={rows} columns={columns} idKey="id" density="compact" verticalAlign="middle" />
  </VStack>;
}
