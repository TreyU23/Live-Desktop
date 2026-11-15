import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { SectionHeader } from './SectionHeader.jsx';
import { icons } from '../ui/icons.js';

const kControlIcon = { wifi: icons.Wifi, bluetooth: icons.Bluetooth };

// Direct controls (radios) change Windows through an approved action, so the switch requests the
// change and shows the current state until it runs. Everything else only opens Windows Settings,
// so those are launch buttons labelled as external in both the caption and the accessible name.
export function SystemControls({ controls, pendingControl, onControl }) {
  const direct = controls.filter(control => control.direct);
  const launchers = controls.filter(control => !control.direct);
  const busy = pendingControl != null;
  return <VStack as="section" gap={2} aria-labelledby="controls-title" id="system-controls" tabIndex={-1}>
    <SectionHeader id="controls-title" title="Controls" />
    <VStack gap={0} role="group" aria-label="Direct controls">
      {direct.map((control, index) => <VStack key={control.id} gap={0}>
        <HStack gap={3} vAlign="center" paddingBlock={2}>
          <Icon icon={kControlIcon[control.id] || icons.Settings} size="sm" color="secondary" />
          <StackItem size="fill">
            <VStack gap={0}>
              <Text>{control.label}</Text>
              <Text type="supporting">{pendingControl === control.id ? 'Waiting for approval…' : !control.available ? 'Unavailable' : `${control.enabled ? 'On' : 'Off'} · changes need approval`}</Text>
            </VStack>
          </StackItem>
          <Switch label={`${control.label}: request ${control.enabled ? 'off' : 'on'}`} isLabelHidden value={Boolean(control.enabled)}
            isLoading={pendingControl === control.id} isDisabled={!control.available || busy} onChange={() => onControl(control.id)} />
        </HStack>
        {index < direct.length - 1 ? <Divider /> : null}
      </VStack>)}
    </VStack>
    {launchers.length ? <VStack gap={2} paddingBlockStart={2}>
      <HStack gap={2} vAlign="center">
        <Icon icon={icons.Info} size="sm" color="secondary" />
        <Text type="supporting">These open Windows Settings. Live Desktop does not change them directly.</Text>
      </HStack>
      <HStack gap={2} wrap="wrap" role="group" aria-label="Windows Settings shortcuts">
        {launchers.map(control => <Button key={control.id} label={control.label} icon={<Icon icon={icons.ExternalLink} />}
          aria-label={!control.available ? `${control.label}: unavailable` : `Open ${control.label} in Windows Settings externally`}
          tooltip={control.detail} isLoading={pendingControl === control.id} isDisabled={!control.available || busy} onClick={() => onControl(control.id)} />)}
      </HStack>
    </VStack> : null}
  </VStack>;
}
