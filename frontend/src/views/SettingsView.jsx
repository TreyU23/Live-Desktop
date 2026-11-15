import { useEffect, useState } from 'react';
import { Icon, PageHeading } from '../components/ui/index.jsx';
import { formatRelativeTime } from '../presentation/formatters.js';
import { MUSIC_PROVIDERS, normalizeMusicUrl } from '../musicProviders.js';
import { ACCENT_PRESETS, effectiveAccentColor } from '../accentColors.js';
export function SettingsView({ activeProfile, onManageProfiles, onOpenApprovals, onRestart, onShutdown, lifecycleBusy, phone, onOpenPhone, headerActions, reduceTransparency, onReduceTransparencyChange, darkMode, onDarkModeChange, accentColor, onAccentColorChange, onCustomAccentColorChange, calendar, onConnectCalendar, onDisconnectCalendar, musicProviderId, musicConnection, musicPlayer, onMusicProviderChange, onSaveMusic, onDisconnectMusic, onRefreshMusic, onOpenMusic, openAiSettings, onSaveOpenAiKey, onDeleteOpenAiKey }) {
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
  const [calendarFormOpen, setCalendarFormOpen] = useState(false);

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

  const saveOpenAi = async (event) => {
    event.preventDefault(); setOpenAiBusy(true); setOpenAiError("");
    try { await onSaveOpenAiKey(openAiKey); setOpenAiKey(""); } catch (keyError) { setOpenAiError(keyError.message); } finally { setOpenAiBusy(false); }
  };
  const applyCustomAccent = (event) => {
    event.preventDefault();
    try { const normalized = onCustomAccentColorChange(customAccent); setCustomAccent(normalized); setAccentError(""); } catch (colorError) { setAccentError(colorError.message); }
  };
  const tile = (icon, color) => <span className="tile tile--32" style={{ "--tile-color": color }} aria-hidden="true"><Icon name={icon} size={17} strokeWidth={2} /></span>;

  return (
    <main className="view-shell settings-view">
      <PageHeading title="Settings" detail="Connect services and choose how Live Desktop looks. Preferences and credentials stay local to this PC." actions={headerActions} />
      <div className="settings-column">
        <section className="card settings-profile" aria-labelledby="settings-profile-title">
          <img src={activeProfile.avatar} alt="" />
          <div><h2 id="settings-profile-title">{activeProfile.name}</h2><span className="muted">Profile stored on this PC · Not a sign-in</span></div>
          <button type="button" onClick={onManageProfiles}>Manage Profiles…</button>
        </section>

        <section className="settings-section" aria-labelledby="appearance-title">
          <h2 id="appearance-title" className="settings-section__title">Appearance</h2>
          <div className="group">
            <div className="settings-row settings-row--stack">
              <span className="settings-row__label">{tile(darkMode ? "Moon" : "Sun", "#5E5CE6")}<span>Theme<small>Saved for this profile</small></span></span>
              <div className="theme-swatches" role="radiogroup" aria-label="Theme">
                {[{ id: "light", label: "Light", dark: false }, { id: "dark", label: "Dark", dark: true }].map(option => (
                  <button key={option.id} type="button" role="radio" aria-checked={darkMode === option.dark} className={`theme-swatch theme-swatch--${option.id}`} onClick={() => onDarkModeChange(option.dark)}>
                    <span className="theme-swatch__preview" aria-hidden="true"><i /><i /></span><span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-row__label">{tile("Layers3", "#636366")}<span id="reduce-transparency-label">Reduce transparency<small>Solid surfaces without glass, glow or wallpaper. Also follows the system setting.</small></span></span>
              <button type="button" className="switch" role="switch" aria-checked={reduceTransparency} aria-labelledby="reduce-transparency-label" onClick={() => onReduceTransparencyChange(!reduceTransparency)}><span className="switch__track" /></button>
            </div>
            <div className="settings-row settings-row--stack">
              <span className="settings-row__label">{tile("Sparkles", "#0A84FF")}<span>Accent color<small>Buttons, links, selection and focus rings</small></span></span>
              <div className="accent-presets" role="group" aria-label="Accent presets">
                {ACCENT_PRESETS.map((preset) => (
                  <button className={`accent-swatch ${accentColor === preset.color ? "active" : ""}`} data-color={preset.id} key={preset.id} type="button" aria-label={`Use ${preset.label} accent`} aria-pressed={accentColor === preset.color} title={preset.label} onClick={() => onAccentColorChange(preset.color)}>
                    <span style={{ backgroundColor: effectiveAccentColor(preset.color, darkMode) }}>{accentColor === preset.color ? <Icon name="Check" size={14} strokeWidth={3} /> : null}</span>
                  </button>
                ))}
              </div>
              <form className="custom-accent-form" onSubmit={applyCustomAccent}>
                <label htmlFor="custom-accent-color">Custom hex color</label>
                <div className="field-row"><span className="custom-accent-preview" aria-hidden="true" style={{ backgroundColor: effectiveAccentColor(/^#[0-9a-f]{6}$/i.test(customAccent) ? customAccent : accentColor, darkMode) }} /><input id="custom-accent-color" value={customAccent} onChange={(event) => { setCustomAccent(event.target.value); setAccentError(""); }} placeholder="#0A84FF" spellCheck="false" autoComplete="off" /><button type="submit">Apply</button></div>
                {accentError ? <p className="form-error" role="alert">{accentError}</p> : <small className="form-hint">Enter a 3- or 6-digit hex code. Text and focus colors are adjusted automatically to stay readable.</small>}
              </form>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="assistant-title">
          <h2 id="assistant-title" className="settings-section__title">Assistant</h2>
          <div className="group">
            <div className="settings-row settings-row--stack" aria-labelledby="openai-key-title">
              <span className="settings-row__label">{tile("Bot", "#30A14E")}<span id="openai-key-title">OpenAI API key<small>Only this local profile uses it. Protected with Windows data protection.</small></span><span className={`connection-pill ${openAiSettings.openAiConfigured ? "connection-pill--on" : ""}`}>{openAiSettings.openAiConfigured ? "Key configured" : "Not set"}</span></span>
              <form className="profile-key-form" onSubmit={saveOpenAi}>
                <label className="visually-hidden" htmlFor="openai-api-key">API key</label>
                <div className="field-row"><input id="openai-api-key" type="password" value={openAiKey} onChange={(event) => setOpenAiKey(event.target.value)} autoComplete="off" placeholder={openAiSettings.profileApiKey ? "Profile key saved" : "sk-..."} required /><button className="btn-primary" type="submit" disabled={openAiBusy}>{openAiBusy ? "Saving…" : openAiSettings.profileApiKey ? "Replace key" : "Save key"}</button>{openAiSettings.profileApiKey ? <button type="button" className="btn-danger" disabled={openAiBusy} onClick={removeOpenAiKey}>Remove</button> : null}</div>
                <small className="form-hint">The key is never returned to the browser after saving.</small>{openAiError ? <p className="form-error" role="alert">{openAiError}</p> : null}
              </form>
            </div>
            <div className="settings-row">
              <span className="settings-row__label">{tile("Shield", "#C66A00")}<span>Remembered approvals<small>Approving an action also allows matching requests later.</small></span></span>
              <button type="button" className="text-action" onClick={onOpenApprovals}>Review <Icon name="ChevronRight" size={14} /></button>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="connections-title">
          <h2 id="connections-title" className="settings-section__title">Connections</h2>
          <div className="group">
            <div className="settings-row settings-row--stack" aria-labelledby="icloud-calendar-title">
              <span className="settings-row__label">{tile("CalendarDays", "#E0284A")}<span id="icloud-calendar-title">iCloud Calendar<small>{calendar.connected ? [calendar.email, calendar.detail, `Last refreshed ${formatRelativeTime(calendar.capturedAt)}`].filter(Boolean).join(" · ") : "Sync your Apple calendars into the Overview day view."}</small></span>
                {calendar.connected ? <button type="button" disabled={calendarBusy} onClick={disconnectCalendar}>Disconnect</button> : <button type="button" aria-expanded={calendarFormOpen} aria-controls="icloud-connect-form" onClick={() => setCalendarFormOpen(open => !open)}>{calendarFormOpen ? "Cancel" : "Connect…"}</button>}
              </span>
              {!calendar.connected && calendarFormOpen ? (
                <form id="icloud-connect-form" className="icloud-connect-form" onSubmit={connectCalendar}>
                  <div className="field"><label htmlFor="icloud-email">Apple Account email</label><input id="icloud-email" type="email" value={calendarEmail} onChange={(event) => { setCalendarEmail(event.target.value); setCalendarError(""); }} autoComplete="username" placeholder="you@icloud.com" required /></div>
                  <div className="field"><label htmlFor="icloud-app-password">App-specific password</label><input id="icloud-app-password" type="password" value={calendarPassword} onChange={(event) => { setCalendarPassword(event.target.value); setCalendarError(""); }} autoComplete="new-password" placeholder="xxxx-xxxx-xxxx-xxxx" required /></div>
                  <div className="field-row"><button className="btn-primary" type="submit" disabled={calendarBusy}>{calendarBusy ? "Connecting…" : "Connect iCloud Calendar"}</button><a className="text-action" href="https://account.apple.com/account/manage" target="_blank" rel="noreferrer">Create an app-specific password <Icon name="ExternalLink" size={13} /></a></div>
                  <small className="form-hint">Use an app-specific password from Apple—never your regular Apple Account password. It is encrypted with Windows data protection and stays on this PC.</small>
                  {calendarError ? <p className="form-error" role="alert">{calendarError}</p> : null}
                </form>
              ) : null}
              {calendar.connected && calendarError ? <p className="form-error" role="alert">{calendarError}</p> : null}
            </div>

            <div className="settings-row settings-row--stack" aria-labelledby="music-account-title">
              <span className="settings-row__label"><span className="tile tile--32 tile--device" aria-hidden="true"><img src={musicProvider.icon} alt="" /></span><span id="music-account-title">Music service<small>Powers the Now Playing card and the Music view. No developer credentials required.</small></span></span>
              <div className="segmented music-provider-picker" role="radiogroup" aria-label="Music service">
                {Object.values(MUSIC_PROVIDERS).map((provider) => (
                  <button key={provider.id} type="button" role="radio" aria-checked={provider.id === musicProviderId} onClick={() => onMusicProviderChange(provider.id)}>
                    <img src={provider.icon} alt="" />{provider.name}
                  </button>
                ))}
              </div>
              <div className="music-auth-row">
                <span><strong>Windows media session</strong><small className="form-hint">{musicPlayer.available ? `${musicPlayer.title} · ${musicPlayer.detail}` : musicPlayer.detail}</small></span>
                <button type="button" onClick={onRefreshMusic}><Icon name="RefreshCw" size={15} /> Refresh status</button>
              </div>
              <form className="music-link-form" onSubmit={saveMusic}>
                <label htmlFor="music-service-url">{musicProvider.linkLabel}</label>
                <div className="field-row"><input id="music-service-url" type="url" value={musicUrl} onChange={(event) => setMusicUrl(event.target.value)} placeholder={musicProvider.placeholder} required /><button type="submit">Connect link</button></div>
                <small className="form-hint">Sign in only inside {musicProvider.name}’s player. In {musicProvider.name}, choose Share, copy the link, and paste it here. Start a track once; Live Desktop then reads the song and sends playback commands locally through Windows.</small>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
              </form>
              <div className="field-row connected-actions"><button className="btn-primary" type="button" onClick={onOpenMusic}><Icon name="Music2" size={16} /> Open full player</button><a className="btn-pill" href={musicProvider.externalUrl} target="_blank" rel="noreferrer"><Icon name="ExternalLink" size={15} /> Open {musicProvider.name} externally</a>{musicConnection.embedUrl ? <button className="text-action text-action--danger" type="button" onClick={onDisconnectMusic}>Disconnect {musicProvider.contentLabel}</button> : null}</div>
            </div>

            <div className="settings-row">
              <span className="settings-row__label">{tile("Smartphone", "#636366")}<span>Phone Link<small>{phone?.installed ? phone.detail || "Installed" : "Phone Link setup available"}</small></span></span>
              <button type="button" onClick={onOpenPhone} disabled={!phone?.installed}>Open externally <Icon name="ExternalLink" size={14} /></button>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="power-title">
          <h2 id="power-title" className="settings-section__title">Live Desktop services</h2>
          <div className="group">
            <div className="settings-row"><span className="settings-row__label">{tile("RotateCw", "#636366")}<span>Restart Live Desktop<small>Restarts the frontend and backend. Windows keeps running.</small></span></span><button type="button" onClick={onRestart} disabled={lifecycleBusy}>Restart</button></div>
            <div className="settings-row"><span className="settings-row__label">{tile("Power", "#C8202F")}<span>Shut down Live Desktop<small>Stops the frontend and backend. It does not shut down Windows.</small></span></span><button type="button" className="btn-danger" onClick={onShutdown} disabled={lifecycleBusy}>Shut Down…</button></div>
          </div>
        </section>
      </div>
    </main>
  );
}
