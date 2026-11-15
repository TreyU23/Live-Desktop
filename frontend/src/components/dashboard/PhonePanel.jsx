import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { Thumbnail } from '@astryxdesign/core/Thumbnail';
import { SectionHeader } from './SectionHeader.jsx';
import { icons } from '../ui/icons.js';
import { getPhoneDeviceVisual } from '../../phoneDevice.js';
import { formatRelativeTime } from '../../presentation/formatters.js';

// Live Phone Link metadata; the picture follows the linked platform (iPhone, Android, or none).
export function PhonePanel({ phone, onOpen, onRefresh, onCopy, busy, refreshing }) {
  const ready = phone?.installed;
  const connected = phone?.connected;
  const visual = getPhoneDeviceVisual(phone);
  const system = ready ? [phone.osName, phone.model].filter(value => value && value !== 'Unknown').join(', ') : '';
  return <VStack as="section" gap={2} aria-labelledby="phone-title" data-phone-platform={visual.platform}>
    <SectionHeader id="phone-title" title="Phone">
      <IconButton variant="ghost" size="sm" label="Refresh Phone Link information" icon={<Icon icon={icons.Refresh} />} isLoading={refreshing} onClick={onRefresh} />
    </SectionHeader>
    <HStack gap={3} vAlign="center">
      {visual.src ? <Thumbnail src={visual.src} alt={visual.alt} /> : <Icon icon={icons.Smartphone} color="secondary" aria-label={visual.alt} />}
      <StackItem size="fill">
        <VStack gap={0}>
          <Text weight="medium">{ready ? phone.deviceName || 'Linked phone' : 'Your phone'}</Text>
          <Text type="supporting">{system || phone?.detail || 'Phone Link setup available'}</Text>
        </VStack>
      </StackItem>
    </HStack>
    <MetadataList>
      <MetadataListItem label="Link">
        <HStack gap={2} vAlign="center"><StatusDot variant={connected ? 'success' : 'neutral'} label={connected ? 'Connected' : 'Not connected'} /><Text>{phone?.detail || (connected ? 'Connected' : 'Not connected')}</Text></HStack>
      </MetadataListItem>
      <MetadataListItem label="Battery">{phone?.batteryPercent == null ? 'Not available' : `${phone.batteryPercent}%`}</MetadataListItem>
      <MetadataListItem label="Last sync">{formatRelativeTime(phone?.lastSyncedAt)}</MetadataListItem>
      <MetadataListItem label="Notifications">{phone?.notificationsAvailable ? 'Available in Phone Link' : 'No new notification signal'}</MetadataListItem>
    </MetadataList>
    <HStack gap={2} wrap="wrap">
      <Button label="Open Phone Link externally" size="sm" icon={<Icon icon={icons.ExternalLink} />} isDisabled={!ready || busy} onClick={onOpen} />
      <Button label="Copy device" size="sm" variant="ghost" icon={<Icon icon={icons.Copy} />} isDisabled={!ready} onClick={onCopy} />
    </HStack>
  </VStack>;
}
