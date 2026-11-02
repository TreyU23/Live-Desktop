import { useEffect, useState } from 'react';
import { Icon } from '../components/ui/index.jsx';
import { formatRelativeTime } from '../presentation/formatters.js';
import { MUSIC_PROVIDERS, normalizeMusicUrl } from '../musicProviders.js';
import { ACCENT_PRESETS, effectiveAccentColor } from '../accentColors.js';
export function SettingsView({ darkMode, onDarkModeChange, accentColor, onAccentColorChange, onCustomAccentColorChange, calendar, onConnectCalendar, onDisconnectCalendar, musicProviderId, musicConnection, musicPlayer, onMusicProviderChange, onSaveMusic, onDisconnectMusic, onRefreshMusic, onOpenMusic, openAiSettings, onSaveOpenAiKey, onDeleteOpenAiKey }) {
  const musicProvider = MUSIC_PROVIDERS[musicProviderId];
  const [musicUrl, setMusicUrl] = useState(musicConnection.sourceUrl || "");
  const [error, setError] = useState("");
  const [calendarEmail, setCalendarEmail] = useState(calendar.email || "");
  const [calendarPassword, setCalendarPassword] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiBusy, setOpenAiBusy] = useState(false);
  const [openAiError, setOpenAiError] = useState("");
  const [customAccent, setCustomAccent] = useState(accentColor);
  const [accentError, setAccentError] = useState("");

  useEffect(() => {
    setMusicUrl(musicConnection.sourceUrl || "");
    setError("");
  }, [musicConnection.sourceUrl, musicProviderId]);

  useEffect(() => {
    setCustomAccent(accentColor);
    setAccentError("");
  }, [accentColor]);

  const saveMusic = (event) => {
    event.preventDefault();
    try {
      const embedUrl = normalizeMusicUrl(musicProviderId, musicUrl);
      onSaveMusic({ sourceUrl: musicUrl.trim(), embedUrl });
      setError("");
    } catch (urlError) {
      setError(urlError.message);
    }
  };

  const connectCalendar = async (event) => {
    event.preventDefault();
    setCalendarBusy(true);
    setCalendarError("");
    try {
      await onConnectCalendar(calendarEmail, calendarPassword);
      setCalendarPassword("");
    } catch (connectionError) {
      setCalendarError(connectionError.message);
    } finally {
      setCalendarBusy(false);
    }
  };

  const removeOpenAiKey = async () => {
    if (openAiBusy) return;
    setOpenAiBusy(true); setOpenAiError('');
    try { await onDeleteOpenAiKey(); } catch (error) { setOpenAiError(error.message); }
    finally { setOpenAiBusy(false); }
  };
  const disconnectCalendar = async () => {
    if (calendarBusy) return;
    setCalendarBusy(true); setCalendarError('');
    try { if (await onDisconnectCalendar() === false) setCalendarError('Could not disconnect iCloud. Try again.'); }
    catch (error) { setCalendarError(error.message); }
    finally { setCalendarBusy(false); }
  };

  return (
    <main className="view-shell settings-view">
      <header className="page-heading"><div><h1>Settings</h1><p>Connect services and choose how Live Desktop looks. Preferences and credentials stay local to this PC.</p></div></header>
      <div className="settings-grid">
        <section className="settings-card settings-card--credentials" aria-labelledby="openai-key-title">
          <div className="settings-card__icon"><Icon name="Bot" size={20} /></div>
          <div className="settings-card__content">
            <div className="settings-title-row"><div><h2 id="openai-key-title">OpenAI API key</h2><p>This key belongs only to the current local profile and is protected with Windows data protection.</p></div><span className={`connection-pill ${openAiSettings.openAiConfigured ? "connection-pill--on" : ""}`}>{openAiSettings.openAiConfigured ? "Key configured" : "Not connected"}</span></div>
            <form className="profile-key-form" onSubmit={async (event) => { event.preventDefault(); setOpenAiBusy(true); setOpenAiError(""); try { await onSaveOpenAiKey(openAiKey); setOpenAiKey(""); } catch (keyError) { setOpenAiError(keyError.message); } finally { setOpenAiBusy(false); } }}>
              <label htmlFor="openai-api-key">API key</label><div><input id="openai-api-key" type="password" value={openAiKey} onChange={(event) => setOpenAiKey(event.target.value)} autoComplete="off" placeholder={openAiSettings.profileApiKey ? "Profile key saved" : "sk-..."} required /><button className="primary-button" type="submit" disabled={openAiBusy}>{openAiBusy ? "Saving…" : openAiSettings.profileApiKey ? "Replace key" : "Save key"}</button>{openAiSettings.profileApiKey ? <button className="secondary-button" type="button" disabled={openAiBusy} onClick={removeOpenAiKey}>Remove</button> : null}</div>
              <small>The key is never returned to the browser after saving.</small>{openAiError ? <p className="form-error" role="alert">{openAiError}</p> : null}
            </form>
          </div>
        </section>
        <section className="settings-card settings-card--appearance" aria-labelledby="appearance-title">
          <div className="settings-card__icon"><Icon name={darkMode ? "Moon" : "Sun"} size={20} /></div>
          <div className="settings-card__content">
            <h2 id="appearance-title">Appearance</h2>
            <p>Dark mode uses the completely black background selected for this dashboard.</p>
            <fieldset className="accent-settings">
              <legend>Accent color</legend>
              <div className="accent-presets">
                {ACCENT_PRESETS.map((preset) => (
                  <button className={accentColor === preset.color ? "active" : ""} data-color={preset.id} key={preset.id} type="button" aria-label={`Use ${preset.label} accent`} aria-pressed={accentColor === preset.color} onClick={() => onAccentColorChange(preset.color)}>
                    <span style={{ backgroundColor: effectiveAccentColor(preset.color, darkMode) }} />{preset.label}{accentColor === preset.color ? <Icon name="Check" size={14} /> : null}
                  </button>
                ))}
              </div>
              <form className="custom-accent-form" onSubmit={(event) => { event.preventDefault(); try { const normalized = onCustomAccentColorChange(customAccent); setCustomAccent(normalized); setAccentError(""); } catch (colorError) { setAccentError(colorError.message); } }}>
                <label htmlFor="custom-accent-color">Custom hex color</label>
                <div><span className="custom-accent-preview" style={{ backgroundColor: effectiveAccentColor(/^#[0-9a-f]{6}$/i.test(customAccent) ? customAccent : accentColor, darkMode) }} /><input id="custom-accent-color" value={customAccent} onChange={(event) => { setCustomAccent(event.target.value); setAccentError(""); }} placeholder="#1685FF" spellCheck="false" autoComplete="off" /><button className="secondary-button" type="submit">Apply</button></div>
                {accentError ? <p className="form-error" role="alert">{accentError}</p> : <small>Enter a 3- or 6-digit hex code.</small>}
              </form>
            </fieldset>
          </div>
          <button className={`toggle settings-toggle ${darkMode ? "toggle--on" : ""}`} type="button" role="switch" aria-checked={darkMode} aria-label="Dark mode" onClick={() => onDarkModeChange(!darkMode)}><span className="toggle__thumb" /></button>
        </section>

        <section className="settings-card settings-card--calendar" aria-labelledby="icloud-calendar-title">
          <div className="settings-card__icon settings-card__icon--icloud"><Icon name="CalendarDays" size={21} /></div>
          <div className="settings-card__content">
            <div className="settings-title-row"><div><h2 id="icloud-calendar-title">iCloud Calendar</h2><p>Sync your Apple calendars into the dashboard’s existing day view.</p></div><span className={`connection-pill ${calendar.connected ? "connection-pill--on" : ""}`}>{calendar.connected ? "Connected" : "Not connected"}</span></div>
            {calendar.connected ? (
              <div className="connected-account-row"><div><strong>{calendar.email}</strong><span>{calendar.detail} · Last refreshed {formatRelativeTime(calendar.capturedAt)}</span></div><button className="secondary-button" type="button" disabled={calendarBusy} onClick={disconnectCalendar}>Disconnect</button></div>
            ) : (
              <form className="icloud-connect-form" onSubmit={connectCalendar}>
                <label htmlFor="icloud-email">Apple Account email</label>
                <input id="icloud-email" type="email" value={calendarEmail} onChange={(event) => { setCalendarEmail(event.target.value); setCalendarError(""); }} autoComplete="username" placeholder="you@icloud.com" required />
                <label htmlFor="icloud-app-password">App-specific password</label>
                <input id="icloud-app-password" type="password" value={calendarPassword} onChange={(event) => { setCalendarPassword(event.target.value); setCalendarError(""); }} autoComplete="new-password" placeholder="xxxx-xxxx-xxxx-xxxx" required />
                <div className="icloud-form-actions"><button className="primary-button" type="submit" disabled={calendarBusy}>{calendarBusy ? "Connecting…" : "Connect iCloud Calendar"}</button><a href="https://account.apple.com/account/manage" target="_blank" rel="noreferrer">Create an app-specific password <Icon name="ExternalLink" size={13} /></a></div>
                <small>Use an app-specific password from Apple—never enter your regular Apple Account password. It is encrypted with Windows data protection and stays on this PC.</small>
                {calendarError ? <p className="form-error" role="alert">{calendarError}</p> : null}
              </form>
            )}
            {calendar.connected && calendarError ? <p className="form-error" role="alert">{calendarError}</p> : null}
          </div>
        </section>

        <section className="settings-card settings-card--music" aria-labelledby="music-account-title">
          <div className={`settings-card__icon settings-card__icon--music settings-card__icon--${musicProviderId}`}><img src={musicProvider.icon} alt="" /></div>
          <div className="settings-card__content">
            <div className="settings-title-row"><div><h2 id="music-account-title">Music service</h2><p>Choose which web player powers the existing dashboard widget and full Music view.</p></div><span className="connection-pill connection-pill--on">No developer credentials</span></div>

            <div className="music-provider-picker" role="radiogroup" aria-label="Music service">
              {Object.values(MUSIC_PROVIDERS).map((provider) => (
                <button key={provider.id} className={provider.id === musicProviderId ? "active" : ""} type="button" role="radio" aria-checked={provider.id === musicProviderId} onClick={() => onMusicProviderChange(provider.id)}>
                  <img src={provider.icon} alt="" /><span><strong>{provider.name}</strong><small>{provider.id === musicProviderId ? "Used by widgets" : "Switch service"}</small></span>{provider.id === musicProviderId ? <Icon name="Check" size={16} /> : null}
                </button>
              ))}
            </div>

            <div className="music-auth-row">
              <div><strong>Local Windows media session</strong><span>{musicPlayer.available ? `${musicPlayer.title} · ${musicPlayer.detail}` : musicPlayer.detail}</span></div>
              <button type="button" className="secondary-button" onClick={onRefreshMusic}><Icon name="RefreshCw" size={15} /> Refresh status</button>
            </div>

            <div className="free-integration-note"><Icon name="CircleCheck" size={18} /><div><strong>No developer credentials required</strong><span>Sign in only inside {musicProvider.name}’s player. Live Desktop reads the active song and sends playback commands locally through Windows.</span></div></div>

            <form className="music-link-form" onSubmit={saveMusic}>
              <label htmlFor="music-service-url">{musicProvider.linkLabel}</label>
              <div><input id="music-service-url" type="url" value={musicUrl} onChange={(event) => setMusicUrl(event.target.value)} placeholder={musicProvider.placeholder} required /><button className="primary-button" type="submit">Connect link</button></div>
              <small>In {musicProvider.name}, choose Share, copy the link, and paste it here. Open the full player and start a track once; the dashboard controls will then follow that Windows media session.</small>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
            </form>

            <div className="connected-actions"><button className="primary-button" type="button" onClick={onOpenMusic}><Icon name="Music2" size={16} /> Open full player</button><a className="secondary-button" href={musicProvider.externalUrl} target="_blank" rel="noreferrer"><Icon name="ExternalLink" size={15} /> Open {musicProvider.name} externally</a>{musicConnection.embedUrl ? <button className="text-action text-action--danger" type="button" onClick={onDisconnectMusic}>Disconnect {musicProvider.contentLabel}</button> : null}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

