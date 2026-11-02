import { Icon, ViewShell } from '../components/ui/index.jsx';
import { CompactPlayer } from '../components/media/CompactPlayer.jsx';
export function MusicView(props) {
  return <ViewShell title="Your music" detail={props.musicProvider.playerDescription}>
    <div className="view-toolbar"><span>{props.musicPlayer.available ? 'Windows media session available' : 'Start a track in your player'}</span><button className="secondary-button" type="button" onClick={props.onOpenSettings}><Icon name="Settings" size={16} />Music settings</button></div>
    <div className="music-stage"><CompactPlayer {...props} fullView musicConfigured={Boolean(props.musicConnection.embedUrl)} onOpenMusic={props.onOpenSettings} /></div>
    <div className="provider-boundary"><h2>{props.musicProvider.name} web player</h2><p>Provider-owned content. Sign in inside the player; provider subscription and playback restrictions apply.</p>{!props.musicConnection.embedUrl ? <button type="button" onClick={props.onOpenSettings}>Connect a music link in Settings</button> : null}</div>
  </ViewShell>;
}
