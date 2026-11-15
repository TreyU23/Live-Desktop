import { Icon } from '@astryxdesign/core/Icon';
import { NavIcon } from '@astryxdesign/core/NavIcon';
import { Badge } from '@astryxdesign/core/Badge';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';
import { icons } from '../ui/icons.js';

// The seven view ids are part of the product contract; the shell reports the current one with aria-current.
export const NAV_ITEMS = [
  { id: 'home', label: 'Overview', icon: icons.Home, group: 'Desktop' },
  { id: 'system', label: 'System Info', icon: icons.Monitor, group: 'Desktop' },
  { id: 'conversations', label: 'Conversations', icon: icons.Messages, group: 'Assistant' },
  { id: 'approvals', label: 'Approvals', icon: icons.Shield, group: 'Assistant' },
  { id: 'memories', label: 'Memories', icon: icons.Bookmark, group: 'Assistant' },
  { id: 'music', label: 'Music', icon: icons.Music, group: 'Media' },
  { id: 'settings', label: 'Settings', icon: icons.Settings, group: 'Live Desktop' },
];
const kGroups = ['Desktop', 'Assistant', 'Media', 'Live Desktop'];

export function Navigation({ activeView, onNavigate, pendingCount, hostName, connected, footer }) {
  // Badge carries counts only; the visually hidden word keeps "3 pending" in the accessible name.
  const pending = pendingCount ? <Badge label={<>{pendingCount}<VisuallyHidden> pending</VisuallyHidden></>} /> : null;
  return <SideNav aria-label="Primary navigation"
    header={<SideNavHeading heading="Live Desktop" subheading={`${hostName} · ${connected ? 'Local mode' : 'Backend offline'}`}
      icon={<NavIcon icon={<Icon icon={icons.Zap} size="sm" />} />} />}
    footer={footer}>
    {kGroups.map(group => <SideNavSection key={group} title={group}>
      {NAV_ITEMS.filter(entry => entry.group === group).map(entry => <SideNavItem key={entry.id} label={entry.label} icon={entry.icon}
        isSelected={activeView === entry.id} onClick={() => onNavigate(entry.id)}
        endContent={entry.id === 'approvals' ? pending : undefined} />)}
    </SideNavSection>)}
  </SideNav>;
}
