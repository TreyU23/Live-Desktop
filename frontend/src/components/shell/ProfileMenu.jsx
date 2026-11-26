import { useEffect, useState } from 'react';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Icon } from '@astryxdesign/core/Icon';
import { Item } from '@astryxdesign/core/Item';
import { Layout, LayoutContent, LayoutFooter, HStack, VStack } from '@astryxdesign/core/Layout';
import { List } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { icons } from '../ui/icons.js';
import { AvatarError, avatarDataUrl } from '../../profileAvatar.js';

const kDefaultAvatar = '/assets/user-avatar.png';

// Profiles organize local data; they are not authentication. The menu switches; the dialog manages.
export function ProfileMenu({ profiles, activeProfile, onSwitch, onManage }) {
  const items = [
    { type: 'section', title: 'Profiles', items: profiles.map(profile => ({
      id: profile.id, label: profile.name,
      description: profile.id === activeProfile.id ? 'Current profile' : 'Switch profile',
      icon: profile.id === activeProfile.id ? icons.Check : icons.User,
      onClick: () => profile.id !== activeProfile.id && onSwitch(profile.id),
    })) },
    { type: 'divider' },
    { label: 'Manage profiles…', icon: icons.Users, onClick: onManage },
  ];
  return <DropdownMenu items={items} placement="above" hasChevron={false}
    button={{ label: `${activeProfile.name}, switch profile`, variant: 'ghost', width: '100%',
      icon: <Avatar src={activeProfile.avatar} name={activeProfile.name} size="sm" tooltip={false} />,
      children: activeProfile.name }} />;
}

export function ProfileDialog({ isOpen, onOpenChange, profiles, activeProfile, onProfilesChange, onSwitch, onDelete, onError }) {
  const [name, setName] = useState(activeProfile.name);
  const [photo, setPhoto] = useState(null);
  useEffect(() => setName(activeProfile.name), [activeProfile.id, activeProfile.name]);
  const updateActive = changes => onProfilesChange(profiles.map(profile => profile.id === activeProfile.id ? { ...profile, ...changes } : profile));
  // The photo is cut to a small square avatar first; a full-size data URL would overflow localStorage (issue #29).
  const choosePhoto = async file => {
    setPhoto(null);
    if (!file) return;
    try {
      updateActive({ avatar: await avatarDataUrl(file) });
    } catch (error) {
      onError?.(error instanceof AvatarError ? error.message : 'That photo could not be used.');
    }
  };
  const createProfile = () => {
    const id = crypto.randomUUID().replaceAll('-', '_');
    if (onProfilesChange([...profiles, { id, name: `Profile ${profiles.length + 1}`, avatar: kDefaultAvatar }])) onSwitch(id);
  };
  const saveName = () => { if (name.trim() && name.trim() !== activeProfile.name) updateActive({ name: name.trim().slice(0, 48) }); };
  return <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={480} purpose="form">
    <Layout height="auto"
      header={<DialogHeader title="Profiles" subtitle="Local data organization, not authentication" onOpenChange={onOpenChange} />}
      content={<LayoutContent padding={4}>
        <VStack gap={4}>
          <List hasDividers header={<Text type="label">Switch profile</Text>}>
            {profiles.map(profile => <Item key={profile.id} label={profile.name}
              description={profile.id === activeProfile.id ? 'Current profile' : 'Switch to this profile'}
              startContent={<Avatar src={profile.avatar} name={profile.name} size="sm" tooltip={false} />}
              endContent={profile.id === activeProfile.id ? <Icon icon={icons.Check} label="Current profile" /> : null}
              isSelected={profile.id === activeProfile.id}
              onClick={profile.id === activeProfile.id ? undefined : () => onSwitch(profile.id)} />)}
          </List>
          <TextInput label="Profile name" value={name} onChange={setName} onEnter={saveName} onKeyDown={undefined}
            description="Saved when you press Enter or leave the field." placeholder="Profile name" autoComplete="off" />
          <FileInput label="Profile photo" value={photo} onChange={choosePhoto} accept="image/*" placeholder="Change photo"
            description="Cropped to a square and stored small on this device." />
        </VStack>
      </LayoutContent>}
      footer={<LayoutFooter>
        <HStack gap={2} hAlign="between" wrap="wrap">
          <Button label="Delete profile" variant="destructive" icon={<Icon icon={icons.Trash} />}
            isDisabled={activeProfile.id === 'default' || profiles.length === 1} onClick={() => onDelete(activeProfile.id)} />
          <HStack gap={2}>
            <Button label="New profile" icon={<Icon icon={icons.Plus} />} onClick={createProfile} />
            <Button label="Done" variant="primary" onClick={() => { saveName(); onOpenChange(false); }} />
          </HStack>
        </HStack>
      </LayoutFooter>} />
  </Dialog>;
}
