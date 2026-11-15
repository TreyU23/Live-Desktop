import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { SectionHeader } from './SectionHeader.jsx';
import { icons } from '../ui/icons.js';
import { localDateAtOffset, localIsoDate, eventTime, eventDuration, formatRelativeTime } from '../../presentation/formatters.js';

const kCollapsed = 3;

// iCloud events for one day, sourced through the local backend. Opening Calendar is external.
export function CalendarPanel({ calendar, calendarRefreshing, onCalendarDateChange, onRefreshCalendar, onOpenCalendarSettings, onOpenCalendarExternally }) {
  const [dayOffset, setDayOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const calendarDate = localDateAtOffset(dayOffset);
  const dateKey = localIsoDate(calendarDate);
  const shortDate = calendarDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const events = calendar.date === dateKey
    ? [...(calendar.events || [])].sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || new Date(a.start) - new Date(b.start))
    : [];
  useEffect(() => { onCalendarDateChange(dateKey); }, [dateKey]);
  const now = new Date();
  const visible = expanded ? events : events.slice(0, kCollapsed);

  return <VStack as="section" gap={2} aria-labelledby="calendar-title">
    <SectionHeader id="calendar-title" title="Calendar"><Text type="supporting">{shortDate}</Text></SectionHeader>
    <HStack gap={1} vAlign="center" role="group" aria-label="Calendar day">
      <IconButton variant="ghost" size="sm" label="Previous day" icon={<Icon icon={icons.ChevronLeft} />} onClick={() => setDayOffset(value => value - 1)} />
      <Button label="Today" variant="ghost" size="sm" isDisabled={dayOffset === 0} onClick={() => setDayOffset(0)} />
      <IconButton variant="ghost" size="sm" label="Next day" icon={<Icon icon={icons.ChevronRight} />} onClick={() => setDayOffset(value => value + 1)} />
      <StackItem size="fill" />
      <IconButton variant="ghost" size="sm" label="Refresh iCloud Calendar" icon={<Icon icon={icons.Refresh} />} isLoading={calendarRefreshing} isDisabled={!calendar.connected} onClick={() => onRefreshCalendar(dateKey)} />
    </HStack>
    {!calendar.connected ? <VStack gap={2} hAlign="start">
      <Text type="supporting">Connect iCloud Calendar in Settings to show your real events here.</Text>
      <Button label="Connect iCloud Calendar" onClick={onOpenCalendarSettings} />
    </VStack> : null}
    {calendar.connected && calendar.status === 'error' ? <HStack gap={2} vAlign="center"><StatusDot variant="error" label="Sync error" /><Text>{calendar.detail}</Text></HStack> : null}
    {calendar.connected && calendar.status !== 'error' && calendarRefreshing && calendar.date !== dateKey ? <Text type="supporting" role="status">Syncing iCloud events…</Text> : null}
    {calendar.connected && calendar.status !== 'error' && !calendarRefreshing && events.length === 0 ? <VStack gap={2} hAlign="start">
      <Text type="supporting">No iCloud events for this day.</Text>
      {onOpenCalendarExternally ? <Button label="Open Calendar externally" size="sm" icon={<Icon icon={icons.ExternalLink} />} onClick={onOpenCalendarExternally} /> : null}
    </VStack> : null}
    {visible.length ? <List>
      {visible.map(event => {
        const active = !event.allDay && new Date(event.start) <= now && new Date(event.end) >= now;
        return <ListItem key={event.id} label={event.title}
          description={[event.allDay ? 'All day' : eventDuration(event), event.location || event.calendar || 'iCloud'].filter(Boolean).join(' · ')}
          startContent={<Text type="supporting">{event.allDay ? 'All day' : eventTime(event)}</Text>}
          endContent={active ? <HStack gap={2} vAlign="center"><StatusDot variant="success" label="Now" /><Text type="supporting">Now</Text></HStack> : undefined} />;
      })}
    </List> : null}
    {events.length > kCollapsed ? <Button label={expanded ? 'Show fewer' : `Show all ${events.length}`} variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} /> : null}
    {calendar.connected && calendar.capturedAt ? <Text type="supporting">Synced {formatRelativeTime(calendar.capturedAt)}</Text> : null}
  </VStack>;
}
