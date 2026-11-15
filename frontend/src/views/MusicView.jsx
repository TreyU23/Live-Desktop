import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Page } from '../components/shell/Page.jsx';
import { CompactPlayer } from '../components/media/CompactPlayer.jsx';
import { icons } from '../components/ui/icons.js';
import { MUSIC_PROVIDERS } from '../musicProviders.js';

// Track details and commands come from Windows media controls. The provider's own web player is
// the persistent iframe App renders right after this view, so it is never remounted here.
export function MusicView({ musicProvider, musicProviderId, musicConnection, musicPlayer, onMusicAction, onMusicProviderChange, onOpenMusicExternally, onOpenSettings, headerActions }) {
  return <Page title="Music" detail="Track details and playback commands come from Windows media controls." actions={headerActions}>
    <VStack gap={6}>
      <HStack gap={3} vAlign="center" wrap="wrap">
        <StackItem size="fill">
          {onMusicProviderChange ? <SegmentedControl label="Music provider" value={musicProviderId} onChange={onMusicProviderChange}>
            {Object.entries(MUSIC_PROVIDERS).map(([id, provider]) => <SegmentedControlItem key={id} value={id} label={provider.name} />)}
          </SegmentedControl> : null}
        </StackItem>
        <Button label="Music settings" variant="ghost" icon={<Icon icon={icons.Settings} />} onClick={onOpenSettings} />
        {onOpenMusicExternally ? <Button label={`Open ${musicProvider.name} externally`} icon={<Icon icon={icons.ExternalLink} />} onClick={onOpenMusicExternally} /> : null}
      </HStack>
      <Card padding={4}>
        <CompactPlayer musicProvider={musicProvider} musicPlayer={musicPlayer} musicConfigured={Boolean(musicConnection.embedUrl)} onMusicAction={onMusicAction} fullView />
      </Card>
      {!musicConnection.embedUrl ? <EmptyState title={`${musicProvider.name} web player`}
        description="Provider-owned content. Add a music link in Settings to load the player here; sign in inside it. Provider subscription and playback restrictions apply."
        actions={<Button label="Connect a music link in Settings" onClick={onOpenSettings} />} /> : null}
    </VStack>
  </Page>;
}
