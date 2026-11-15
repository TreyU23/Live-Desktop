import { useEffect, useState } from 'react';
import { Icon } from '../ui/index.jsx';
import { localDateAtOffset, localIsoDate, eventTime, eventDuration, formatRelativeTime } from '../../presentation/formatters.js';
export function CalendarPanel({ calendar, calendarRefreshing, onCalendarDateChange, onRefreshCalendar, onOpenCalendarSettings, onOpenCalendarExternally }) {
  const [dayOffset, setDayOffset] = useState(0);
  const [dayOpen, setDayOpen] = useState(false);
  const calendarDate = localDateAtOffset(dayOffset);
  const dateKey = localIsoDate(calendarDate);
  const dateLabel = calendarDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const events = calendar.date === dateKey ? [...(calendar.events || [])].sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || new Date(a.start) - new Date(b.start)) : [];

  useEffect(() => {
    onCalendarDateChange(dateKey);
  }, [dateKey]);
  const weekday = calendarDate.toLocaleDateString(undefined, { weekday: "long" });
  return (
    <section className="card overview-card overview-card--calendar calendar-column" aria-labelledby="calendar-title">
      <div className="calendar-header">
        <div>
          <span className="calendar-weekday">{weekday}</span>
          <span className="calendar-day" aria-hidden="true">{calendarDate.getDate()}</span>
          <h2 id="calendar-title" className="visually-hidden">iCloud Calendar, {dateLabel}</h2>
        </div>
        <span className="muted calendar-source" title={calendar.connected ? calendar.detail : undefined}>iCloud</span>
      </div>
      <div className="calendar-nav" role="group" aria-label="Calendar day">
        <button type="button" className="btn-icon btn-icon--plain" aria-label="Previous day" onClick={() => setDayOffset((value) => value - 1)}><Icon name="ChevronLeft" size={18} /></button>
        <button type="button" className="chip" onClick={() => setDayOffset(0)} disabled={dayOffset === 0}>Today</button>
        <button type="button" className="btn-icon btn-icon--plain" aria-label="Next day" onClick={() => setDayOffset((value) => value + 1)}><Icon name="ChevronRight" size={18} /></button>
        <button type="button" className="btn-icon btn-icon--plain" aria-label="Refresh iCloud Calendar" onClick={() => onRefreshCalendar(dateKey)} disabled={calendarRefreshing || !calendar.connected}><Icon name="RefreshCw" size={15} className={calendarRefreshing ? "spin" : ""} /></button>
      </div>
      <div className="agenda">
        {!calendar.connected ? <button className="calendar-connect" type="button" onClick={onOpenCalendarSettings}><Icon name="CalendarDays" size={20} /><span><strong>Connect iCloud Calendar</strong><small>Show your real events in this dashboard.</small></span><Icon name="ChevronRight" size={16} /></button> : null}
        {calendar.connected && calendar.status === "error" ? <div className="agenda-empty agenda-empty--error"><Icon name="CircleAlert" size={18} /> {calendar.detail}</div> : null}
        {calendar.connected && calendar.status !== "error" && calendarRefreshing && calendar.date !== dateKey ? <div className="agenda-empty"><Icon name="LoaderCircle" size={18} className="spin" /> Syncing iCloud events…</div> : null}
        {calendar.connected && calendar.status !== "error" && !calendarRefreshing && events.length === 0 ? (
          <div className="agenda-empty">
            <span><Icon name="CalendarDays" size={18} /> No iCloud events for this day.</span>
            {onOpenCalendarExternally ? (
              <button className="text-action" type="button" onClick={onOpenCalendarExternally}>
                Open Calendar externally <Icon name="ExternalLink" size={14} />
              </button>
            ) : null}
          </div>
        ) : null}
        {events.slice(0, dayOpen ? events.length : 2).map((event, index) => <div key={event.id}>{dayOpen && event.allDay && index === 0 ? <h4 className="agenda-group">All-day events</h4> : null}{dayOpen && !event.allDay && (index === 0 || events[index - 1].allDay) ? <h4 className="agenda-group">Scheduled</h4> : null}<AgendaItem time={eventTime(event)} title={event.title} detail={event.location || event.calendar || "iCloud"} duration={event.allDay ? "" : eventDuration(event)} active={!event.allDay && new Date(event.start) <= new Date() && new Date(event.end) >= new Date()} /></div>)}
      </div>
      <button className="text-action card-footer" type="button" aria-expanded={dayOpen} onClick={() => setDayOpen((value) => !value)}>
        {dayOpen ? "Close day view" : "Open day view"} <Icon name="ChevronRight" size={14} />
      </button>
      {dayOpen ? <div className="calendar-inline"><strong>{dateLabel}</strong><span>{calendar.connected ? `${events.length} iCloud event${events.length === 1 ? "" : "s"} · Synced ${formatRelativeTime(calendar.capturedAt)}` : "Connect your account in Settings to sync events."}</span></div> : null}
    </section>
  );
}
function AgendaItem({ time, title, detail, duration, active }) {
  return (
    <div className="agenda-item">
      <i className={active ? "agenda-dot agenda-dot--active" : "agenda-dot"} aria-hidden="true" />
      <div><strong>{title}</strong><span><time>{time}</time>{duration ? ` · ${duration}` : ""} · {detail}</span></div>
    </div>
  );
}
