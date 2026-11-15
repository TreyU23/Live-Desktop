import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { SectionHeader } from './SectionHeader.jsx';

const kCollapsed = 4;

// Running and installed apps reported by Windows. Windows gives no "last used" time, so none is shown.
export function RecentApps({ apps }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? apps : apps.slice(0, kCollapsed);
  const columns = [
    { key: 'name', header: 'App', renderCell: app => <VStack gap={0}><Text>{app.name}</Text>{app.detail ? <Text type="supporting">{app.detail}</Text> : null}</VStack> },
    { key: 'running', header: 'Status', renderCell: app => <HStack gap={2} vAlign="center"><StatusDot variant={app.running ? 'success' : 'neutral'} label={app.running ? 'Running' : 'Installed'} /><Text>{app.running ? 'Running' : 'Installed'}</Text></HStack> },
  ];
  return <VStack as="section" gap={2} aria-labelledby="activity-title">
    <SectionHeader id="activity-title" title="Recent activity"><Text type="supporting">Reported by Windows</Text></SectionHeader>
    {apps.length
      ? <Table data={visible} columns={columns} idKey="id" density="compact" verticalAlign="middle" />
      : <Text type="supporting">No supported running apps detected.</Text>}
    {apps.length > kCollapsed ? <HStack><Button label={showAll ? 'Show less' : `Show all ${apps.length}`} variant="ghost" size="sm" aria-expanded={showAll} onClick={() => setShowAll(value => !value)} /></HStack> : null}
  </VStack>;
}
