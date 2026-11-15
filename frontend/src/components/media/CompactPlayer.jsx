import { Icon } from '../ui/index.jsx';
import { formatPlaybackTime } from '../../presentation/formatters.js';

// Metadata and commands come from the Windows media session; the provider iframe lives in App.jsx.
export function CompactPlayer({ musicProvider, musicPlayer, musicConfigured, onOpenMusic, onMusicAction, onOpenMusicExternally, fullView = false }) {
  const progress = musicPlayer.duration ? Math.min(100, (musicPlayer.elapsed / musicPlayer.duration) * 100) : 0;
  return <div className={`media-widget ${fullView ? 'media-widget--full' : ''}`}>
    <div className="media-label">
      <span><img src={musicProvider.icon} alt="" /> {musicProvider.name}{musicPlayer.ready ? ' · live' : ''}</span>
      {fullView ? null : <button type="button" className="text-action" onClick={onOpenMusic}>{musicConfigured ? 'Open player' : 'Connect'}<Icon name="ChevronRight" size={13} /></button>}
    </div>
    <div className="track">
      {musicPlayer.available && musicPlayer.artwork ? <img src={musicPlayer.artwork} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} alt={`Current ${musicProvider.name} artwork`} /> : <span className="track-placeholder tile--device" aria-hidden="true"><Icon name="Music2" size={24} /></span>}
      <div><strong>{musicPlayer.title}</strong><span>{musicPlayer.artist}</span><small>{musicPlayer.album}</small></div>
    </div>
    {!musicPlayer.available && onOpenMusicExternally ? (
      <button className="text-action media-empty-action" type="button" onClick={onOpenMusicExternally}>
        Open {musicProvider.name} externally <Icon name="ExternalLink" size={14} />
      </button>
    ) : null}
    <div className="progress" role="progressbar" aria-label="Playback progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i style={{ width: `${progress}%` }} /></div>
    <div className="track-time"><span>{formatPlaybackTime(musicPlayer.elapsed)}</span><span>{formatPlaybackTime(musicPlayer.duration)}</span></div>
    <div className="media-controls" role="group" aria-label="Playback">
      <button className={`btn-icon btn-icon--plain ${musicPlayer.shuffled ? 'active' : ''}`} type="button" aria-label="Toggle shuffle" aria-pressed={Boolean(musicPlayer.shuffled)} onClick={() => onMusicAction('shuffle')}><Icon name="Shuffle" size={16} /></button>
      <button className="btn-icon btn-icon--plain" type="button" aria-label="Previous track" onClick={() => onMusicAction('previous')}><Icon name="SkipBack" size={19} /></button>
      <button className="play-button" type="button" aria-label={musicPlayer.playing ? 'Pause' : 'Play'} onClick={() => onMusicAction(musicPlayer.playing ? 'pause' : 'play')}><Icon name={musicPlayer.playing ? 'Pause' : 'Play'} size={19} /></button>
      <button className="btn-icon btn-icon--plain" type="button" aria-label="Next track" onClick={() => onMusicAction('next')}><Icon name="SkipForward" size={19} /></button>
      <button className={`btn-icon btn-icon--plain ${musicPlayer.muted ? 'active' : ''}`} type="button" aria-label="Toggle mute" aria-pressed={Boolean(musicPlayer.muted)} onClick={() => onMusicAction('mute')}><Icon name={musicPlayer.muted ? 'VolumeX' : 'Volume2'} size={17} /></button>
    </div>
  </div>;
}
