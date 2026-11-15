import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Text } from '@astryxdesign/core/Text';
import { Thumbnail } from '@astryxdesign/core/Thumbnail';
import { icons } from '../ui/icons.js';
import { formatPlaybackTime } from '../../presentation/formatters.js';

// Metadata and commands come from the Windows media session; the provider iframe lives in App.jsx.
export function CompactPlayer({ musicProvider, musicPlayer, musicConfigured, onOpenMusic, onMusicAction, onOpenMusicExternally, fullView = false }) {
  const progress = musicPlayer.duration ? Math.min(100, (musicPlayer.elapsed / musicPlayer.duration) * 100) : 0;
  return <VStack gap={3}>
    <HStack gap={3} vAlign="center">
      {musicPlayer.available && musicPlayer.artwork
        ? <Thumbnail src={musicPlayer.artwork} alt={`Current ${musicProvider.name} artwork`} />
        : <Icon icon={icons.Music} size="lg" color="secondary" />}
      <StackItem size="fill">
        <VStack gap={0}>
          <Text weight="semibold" maxLines={1}>{musicPlayer.available ? musicPlayer.title : 'Nothing playing'}</Text>
          <Text type="supporting" maxLines={1}>{musicPlayer.available ? [musicPlayer.artist, musicPlayer.album].filter(Boolean).join(' · ') : 'Start a track in your player'}</Text>
          {musicPlayer.available ? <Text type="supporting">{musicProvider.name}{musicPlayer.ready ? ' · live' : ''}</Text> : null}
        </VStack>
      </StackItem>
    </HStack>
    <VStack gap={1}>
      <ProgressBar label="Playback progress" isLabelHidden value={Math.round(progress)} variant="neutral" />
      <HStack gap={2}>
        <StackItem size="fill"><Text type="supporting">{formatPlaybackTime(musicPlayer.elapsed)}</Text></StackItem>
        <Text type="supporting">{formatPlaybackTime(musicPlayer.duration)}</Text>
      </HStack>
    </VStack>
    <HStack gap={1} vAlign="center" wrap="wrap" role="group" aria-label="Playback">
      <IconButton variant={musicPlayer.shuffled ? 'secondary' : 'ghost'} label="Toggle shuffle" aria-pressed={Boolean(musicPlayer.shuffled)} icon={<Icon icon={icons.Shuffle} />} onClick={() => onMusicAction('shuffle')} />
      <IconButton variant="ghost" label="Previous track" icon={<Icon icon={icons.SkipBack} />} onClick={() => onMusicAction('previous')} />
      <IconButton variant="primary" label={musicPlayer.playing ? 'Pause' : 'Play'} icon={<Icon icon={musicPlayer.playing ? icons.Pause : icons.Play} />} onClick={() => onMusicAction(musicPlayer.playing ? 'pause' : 'play')} />
      <IconButton variant="ghost" label="Next track" icon={<Icon icon={icons.SkipForward} />} onClick={() => onMusicAction('next')} />
      <IconButton variant={musicPlayer.muted ? 'secondary' : 'ghost'} label="Toggle mute" aria-pressed={Boolean(musicPlayer.muted)} icon={<Icon icon={musicPlayer.muted ? icons.VolumeOff : icons.Volume} />} onClick={() => onMusicAction('mute')} />
      <StackItem size="fill" />
      {!fullView ? <Button label={musicConfigured ? 'Open player' : 'Connect'} variant="ghost" size="sm" onClick={onOpenMusic} /> : null}
      {!musicPlayer.available && onOpenMusicExternally ? <Button label={`Open ${musicProvider.name} externally`} size="sm" icon={<Icon icon={icons.ExternalLink} />} onClick={onOpenMusicExternally} /> : null}
    </HStack>
  </VStack>;
}
