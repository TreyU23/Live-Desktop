import { useEffect, useState } from 'react';
import { FaCircle } from 'react-icons/fa6';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Page } from '../components/shell/Page.jsx';
import { SettingRow, SettingSection } from '../components/ui/SettingRow.jsx';
import { icons } from '../components/ui/icons.js';
import { formatRelativeTime } from '../presentation/formatters.js';
import { MUSIC_PROVIDERS, normalizeMusicUrl } from '../musicProviders.js';
import { ACCENT_PRESETS } from '../accentColors.js';

const kSections = [
  { id: 'settings-profile', label: 'Profile' },
  { id: 'settings-appearance', label: 'Appearance' },
  { id: 'settings-assistant', label: 'Assistant' },
  { id: 'settings-connections', label: 'Connections' },
  { id: 'settings-services', label: 'Live Desktop services' },
];

function StateLabel({ tone, children }) {
  return <HStack gap={2} vAlign="center"><StatusDot variant={tone} label={String(children)} /><Text type="supporting">{children}</Text></HStack>;
}

export function SettingsView({ activeProfile, onManageProfiles, onOpenApprovals, onRestart, onShutdown, lifecycleBusy, phone, onOpenPhone, headerActions, reduceTransparency, onReduceTransparencyChange, appearance, onAppearanceChange, accentId, onAccentChange, calendar, onConnectCalendar, onDisconnectCalendar, musicProviderId, musicConnection, musicPlayer, onMusicProviderChange, onSaveMusic, onDisconnectMusic, onRefreshMusic, onOpenMusic, openAiSettings, onSaveOpenAiKey, onDeleteOpenAiKey }) {
  const isWide = useMediaQuery('(min-width: 1024px)');
  const musicProvider = MUSIC_PROVIDERS[musicProviderId];
  const [musicUrl, setMusicUrl] = useState(musicConnection.sourceUrl || '');
  const [musicError, setMusicError] = useState('');
  const [calendarEmail, setCalendarEmail] = useState(calendar.email || '');
  const [calendarPassword, setCalendarPassword] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarFormOpen, setCalendarFormOpen] = useState(false);
  const [openAiKey, setOpenAiKey] = useState('');
  const [openAiBusy, setOpenAiBusy] = useState(false);
  const [openAiError, setOpenAiError] = useState('');

  useEffect(() => { setMusicUrl(musicConnection.sourceUrl || ''); setMusicError(''); }, [musicConnection.sourceUrl, musicProviderId]);

  const saveMusic = () => {
    try {
      const embedUrl = normalizeMusicUrl(musicProviderId, musicUrl);
      onSaveMusic({ sourceUrl: musicUrl.trim(), embedUrl });
      setMusicError('');
    } catch (urlError) { setMusicError(urlError.message); }
  };
  const connectCalendar = async () => {
    if (calendarBusy || !calendarEmail.trim() || !calendarPassword) return;
    setCalendarBusy(true); setCalendarError('');
    try { await onConnectCalendar(calendarEmail, calendarPassword); setCalendarPassword(''); }
    catch (connectionError) { setCalendarError(connectionError.message); }
    finally { setCalendarBusy(false); }
  };
  const disconnectCalendar = async () => {
    if (calendarBusy) return;
    setCalendarBusy(true); setCalendarError('');
    try { if (await onDisconnectCalendar() === false) setCalendarError('Could not disconnect iCloud. Try again.'); }
    catch (disconnectError) { setCalendarError(disconnectError.message); }
    finally { setCalendarBusy(false); }
  };
  const saveOpenAi = async () => {
    if (openAiBusy || !openAiKey.trim()) return;
    setOpenAiBusy(true); setOpenAiError('');
    try { await onSaveOpenAiKey(openAiKey); setOpenAiKey(''); } catch (keyError) { setOpenAiError(keyError.message); } finally { setOpenAiBusy(false); }
  };
  const removeOpenAiKey = async () => {
    if (openAiBusy) return;
    setOpenAiBusy(true); setOpenAiError('');
    try { await onDeleteOpenAiKey(); } catch (keyError) { setOpenAiError(keyError.message); } finally { setOpenAiBusy(false); }
  };
  const jumpTo = id => document.getElementById(id)?.scrollIntoView({ block: 'start' });

  const sections = <VStack gap={8} maxWidth={720}>
    <SettingSection id="settings-profile" title="Profile">
      <SettingRow isLast title={activeProfile.name} description="Profiles keep settings, conversations and connections separate on this PC. They are not sign-ins.">
        <Avatar src={activeProfile.avatar} name={activeProfile.name} size="sm" tooltip={false} />
        <Button label="Manage profiles…" onClick={onManageProfiles} />
      </SettingRow>
    </SettingSection>

    <SettingSection id="settings-appearance" title="Appearance">
      <SettingRow title="Theme" description="System follows the Windows light or dark setting. Saved for this profile.">
        <SegmentedControl label="Theme" value={appearance} onChange={onAppearanceChange}>
          <SegmentedControlItem value="light" label="Light" icon={<Icon icon={icons.Sun} />} />
          <SegmentedControlItem value="dark" label="Dark" icon={<Icon icon={icons.Moon} />} />
          <SegmentedControlItem value="system" label="System" icon={<Icon icon={icons.Monitor} />} />
        </SegmentedControl>
      </SettingRow>
      <SettingRow title="Reduce transparency" description="Solid surfaces on views that still use the glass styles.">
        <Switch label="Reduce transparency" isLabelHidden value={reduceTransparency} onChange={onReduceTransparencyChange} />
      </SettingRow>
      <SettingRow isLast title="Accent" description="Neutral is the theme default. Other accents are applied through the theme.">
        <SegmentedControl label="Accent" value={accentId} onChange={onAccentChange}>
          {ACCENT_PRESETS.map(preset => <SegmentedControlItem key={preset.id} value={preset.id} label={preset.label}
            icon={<Icon icon={FaCircle} color={preset.swatch} size="xsm" />} />)}
        </SegmentedControl>
      </SettingRow>
    </SettingSection>

    <SettingSection id="settings-assistant" title="Assistant">
      <SettingRow title="OpenAI API key"
        description="Only this local profile uses it. Protected with Windows data protection and never returned to the browser after saving."
        details={<HStack gap={2} vAlign="end" wrap="wrap">
          <StackItem size="fill">
            <TextInput type="password" label="API key" value={openAiKey} onChange={setOpenAiKey} onEnter={saveOpenAi} autoComplete="off"
              placeholder={openAiSettings.profileApiKey ? 'Profile key saved' : 'sk-…'} status={openAiError ? { type: 'error', message: openAiError } : undefined} />
          </StackItem>
          <Button label={openAiBusy ? 'Saving…' : openAiSettings.profileApiKey ? 'Replace key' : 'Save key'} variant="primary" isLoading={openAiBusy} isDisabled={!openAiKey.trim()} onClick={saveOpenAi} />
          {openAiSettings.profileApiKey ? <Button label="Remove key" variant="destructive" isDisabled={openAiBusy} onClick={removeOpenAiKey} /> : null}
        </HStack>}>
        <StateLabel tone={openAiSettings.openAiConfigured ? 'success' : 'warning'}>{openAiSettings.openAiConfigured ? 'Key configured' : 'Not set'}</StateLabel>
      </SettingRow>
      <SettingRow isLast title="Remembered approvals" description="Allowing an action also allows matching requests later.">
        <Button label="Review approvals" endContent={<Icon icon={icons.ChevronRight} />} onClick={onOpenApprovals} />
      </SettingRow>
    </SettingSection>

    <SettingSection id="settings-connections" title="Connections">
      <SettingRow title="iCloud Calendar"
        description={calendar.connected ? [calendar.email, calendar.detail, `Last refreshed ${formatRelativeTime(calendar.capturedAt)}`].filter(Boolean).join(' · ') : 'Sync your Apple calendars into the Overview day view.'}
        details={!calendar.connected && calendarFormOpen ? <VStack gap={3}>
          <TextInput type="email" label="Apple Account email" value={calendarEmail} onChange={value => { setCalendarEmail(value); setCalendarError(''); }} autoComplete="username" placeholder="you@icloud.com" isRequired />
          <TextInput type="password" label="App-specific password" value={calendarPassword} onChange={value => { setCalendarPassword(value); setCalendarError(''); }} onEnter={connectCalendar}
            autoComplete="new-password" placeholder="xxxx-xxxx-xxxx-xxxx" isRequired
            description="Use an app-specific password from Apple, never your regular Apple Account password. It is encrypted with Windows data protection and stays on this PC."
            status={calendarError ? { type: 'error', message: calendarError } : undefined} />
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Button label={calendarBusy ? 'Connecting…' : 'Connect iCloud Calendar'} variant="primary" isLoading={calendarBusy} isDisabled={!calendarEmail.trim() || !calendarPassword} onClick={connectCalendar} />
            <Link href="https://account.apple.com/account/manage" isExternalLink>Create an app-specific password</Link>
          </HStack>
        </VStack> : calendar.connected && calendarError ? <Banner status="error" title={calendarError} /> : null}>
        <StateLabel tone={calendar.connected ? calendar.status === 'error' ? 'warning' : 'success' : 'neutral'}>{calendar.connected ? calendar.status === 'error' ? 'Sync error' : 'Connected' : 'Not connected'}</StateLabel>
        {calendar.connected
          ? <Button label="Disconnect" isLoading={calendarBusy} onClick={disconnectCalendar} />
          : <Button label={calendarFormOpen ? 'Cancel' : 'Connect…'} aria-expanded={calendarFormOpen} onClick={() => setCalendarFormOpen(open => !open)} />}
      </SettingRow>

      <SettingRow title="Music service" description="One provider at a time. Powers Now Playing and the Music view. No developer account needed."
        details={<VStack gap={3}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <StackItem size="fill">
              <VStack gap={0.5}>
                <Text weight="medium">Windows media session</Text>
                <Text type="supporting">{musicPlayer.available ? `${musicPlayer.title} · ${musicPlayer.detail}` : musicPlayer.detail}</Text>
              </VStack>
            </StackItem>
            <Button label="Refresh status" icon={<Icon icon={icons.Refresh} />} onClick={onRefreshMusic} />
          </HStack>
          <HStack gap={2} vAlign="end" wrap="wrap">
            <StackItem size="fill">
              <TextInput type="url" label={musicProvider.linkLabel} value={musicUrl} onChange={setMusicUrl} onEnter={saveMusic} placeholder={musicProvider.placeholder}
                description={`Sign in only inside ${musicProvider.name}'s player. In ${musicProvider.name}, choose Share, copy the link, and paste it here.`}
                status={musicError ? { type: 'error', message: musicError } : undefined} />
            </StackItem>
            <Button label="Connect link" isDisabled={!musicUrl.trim()} onClick={saveMusic} />
          </HStack>
          <HStack gap={2} wrap="wrap">
            <Button label="Open full player" variant="primary" icon={<Icon icon={icons.Music} />} onClick={onOpenMusic} />
            <Button label={`Open ${musicProvider.name} externally`} icon={<Icon icon={icons.ExternalLink} />} href={musicProvider.externalUrl} target="_blank" rel="noreferrer" />
            {musicConnection.embedUrl ? <Button label={`Disconnect ${musicProvider.contentLabel}`} variant="ghost" onClick={onDisconnectMusic} /> : null}
          </HStack>
        </VStack>}>
        <SegmentedControl label="Music service" value={musicProviderId} onChange={onMusicProviderChange}>
          {Object.values(MUSIC_PROVIDERS).map(provider => <SegmentedControlItem key={provider.id} value={provider.id} label={provider.name} />)}
        </SegmentedControl>
      </SettingRow>

      <SettingRow isLast title="Phone Link" description={phone?.installed ? phone.detail || 'Installed' : 'Phone Link setup available'}>
        <Button label="Open Phone Link externally" icon={<Icon icon={icons.ExternalLink} />} isDisabled={!phone?.installed} onClick={onOpenPhone} />
      </SettingRow>
    </SettingSection>

    <SettingSection id="settings-services" title="Live Desktop services">
      <SettingRow title="Restart Live Desktop" description="Restarts the local frontend and backend services. Windows keeps running.">
        <Button label="Restart" icon={<Icon icon={icons.Restart} />} isDisabled={lifecycleBusy} onClick={onRestart} />
      </SettingRow>
      <SettingRow isLast title="Stop Live Desktop" description="Stops the local services until you run start.cmd again. It does not shut down Windows.">
        <Button label="Stop…" variant="destructive" icon={<Icon icon={icons.Power} />} isDisabled={lifecycleBusy} onClick={onShutdown} />
      </SettingRow>
    </SettingSection>
  </VStack>;

  return <Page title="Settings" detail="Preferences and connections for this profile, stored only on this PC." actions={headerActions}>
    {isWide ? <HStack gap={8} vAlign="start">
      <StackItem>
        <List density="compact" header={<Text type="label" color="secondary">Sections</Text>}>
          {kSections.map(section => <ListItem key={section.id} label={section.label} onClick={() => jumpTo(section.id)} />)}
        </List>
      </StackItem>
      <StackItem size="fill">{sections}</StackItem>
    </HStack> : sections}
  </Page>;
}
