import { Icon } from '../ui/index.jsx';
import { formatPlaybackTime } from '../../presentation/formatters.js';
export function CompactPlayer({ musicProvider, musicPlayer, musicConfigured, onOpenMusic, onMusicAction, onOpenMusicExternally, fullView = false }) { return (<div className="media-widget">
        <div className="media-label">
          <span><img src={musicProvider.icon} alt="" /> {musicProvider.name} {musicPlayer.ready ? "· live" : ""}</span>
          {fullView ? null : <button type="button" onClick={onOpenMusic}>{musicConfigured ? "Open player" : "Connect"}<Icon name="ChevronRight" size={13} /></button>}
        </div>
        <div className="track">
          {musicPlayer.available && musicPlayer.artwork ? <img src={musicPlayer.artwork} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} alt={`Current ${musicProvider.name} artwork`} /> : <span className="track-placeholder"><Icon name="Music2" size={24} /></span>}
          <div><strong>{musicPlayer.title}</strong><span>{musicPlayer.artist}</span><small>{musicPlayer.album}</small></div>
        </div>
        {!musicPlayer.available && onOpenMusicExternally ? (
          <button className="text-action media-empty-action" type="button" onClick={onOpenMusicExternally}>
            Open {musicProvider.name} externally <Icon name="ExternalLink" size={14} />
          </button>
        ) : null}
        <div className="progress" aria-label="Playback progress"><i style={{ width: `${musicPlayer.duration ? Math.min(100, (musicPlayer.elapsed / musicPlayer.duration) * 100) : 0}%` }} /></div>
        <div className="track-time"><span>{formatPlaybackTime(musicPlayer.elapsed)}</span><span>{formatPlaybackTime(musicPlayer.duration)}</span></div>
        <div className="media-controls">
          <button className={musicPlayer.shuffled ? "active" : ""} type="button" aria-label="Toggle shuffle" onClick={() => onMusicAction("shuffle")}><Icon name="Shuffle" size={16} /></button>
          <button type="button" aria-label="Previous track" onClick={() => onMusicAction("previous")}><Icon name="SkipBack" size={19} /></button>
          <button className="play-button" type="button" aria-label={musicPlayer.playing ? "Pause" : "Play"} onClick={() => onMusicAction(musicPlayer.playing ? "pause" : "play")}><Icon name={musicPlayer.playing ? "Pause" : "Play"} size={19} /></button>
          <button type="button" aria-label="Next track" onClick={() => onMusicAction("next")}><Icon name="SkipForward" size={19} /></button>
          <button className={musicPlayer.muted ? "active" : ""} type="button" aria-label="Toggle mute" onClick={() => onMusicAction("mute")}><Icon name={musicPlayer.muted ? "VolumeX" : "Volume2"} size={17} /></button>
        </div>
      </div>); }
