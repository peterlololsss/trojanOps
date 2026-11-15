// Owner: D (WP-11). Events on a dashboard: the calendar tile, the funding chip (icon + word), one row
// per event, the Events tab with its Upcoming/Past switch, and the About tab's "Upcoming events"
// panel.
import { Check, Clock, MapPin, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DirectoryEvent, FundingStatus } from '@/lib/directory/types';
import { count, dateBlock, eventTime, fundingText, splitEvents } from '@/lib/directory/view';
import { eventsHref, type EventsWhen } from './model';
import { Empty, Panel, ViewAll } from './parts';
import { SwitchLinks } from './tabs';

/** "NOV" over "20". The row prints the full date, so the tile is decorative. */
export function DateBlock({ iso }: { iso: string }) {
  const { month, day } = dateBlock(iso);
  return (
    <span aria-hidden="true" data-date-block className="flex w-12 shrink-0 flex-col self-start overflow-hidden rounded-md border border-border text-center">
      <span className="bg-primary text-xs font-semibold leading-5 text-primary-foreground">{month}</span>
      <span className="text-xl font-semibold leading-8 tabular-nums">{day}</span>
    </span>
  );
}

const FUNDING_CHIP: Record<FundingStatus, { variant: 'success' | 'attention' | 'neutral'; Icon: typeof Check }> = {
  approved: { variant: 'success', Icon: Check },
  pending: { variant: 'attention', Icon: Clock },
  none: { variant: 'neutral', Icon: Minus },
};

export function FundingChip({ funding }: { funding: NonNullable<DirectoryEvent['funding']> }) {
  const { variant, Icon } = FUNDING_CHIP[funding.status];
  return <Badge variant={variant} className="whitespace-nowrap"><Icon aria-hidden="true" />{fundingText(funding)}</Badge>;
}

/** One event. `compact` drops the summary and chips for the About tab's side panel. */
export function EventRow({ event, compact = false, showDepartment = true }: { event: DirectoryEvent; compact?: boolean; showDepartment?: boolean }) {
  return (
    <li className="flex gap-4 border-b border-border py-3 last:border-b-0">
      <DateBlock iso={event.startsAt} />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold [overflow-wrap:anywhere]">{event.title}</h3>
        <p className="text-muted-foreground"><time dateTime={event.startsAt}>{eventTime(event.startsAt, event.endsAt)}</time></p>
        <p className="flex items-center gap-1 text-muted-foreground"><MapPin aria-hidden="true" className="size-4 shrink-0" />{event.location}</p>
        {!compact && event.summary && <p className="mt-2 max-w-prose">{event.summary}</p>}
        {!compact && ((showDepartment && event.department) || event.funding) && <div className="mt-2 flex flex-wrap items-center gap-2">
          {showDepartment && event.department && <Badge>{event.department.name}</Badge>}
          {event.funding && <FundingChip funding={event.funding} />}
        </div>}
      </div>
      <p className="shrink-0 text-right">
        <span className="block font-semibold tabular-nums">{event.rsvps}</span>
        <span className="text-xs text-muted-foreground">{event.rsvps === 1 ? 'RSVP' : 'RSVPs'}</span>
      </p>
    </li>
  );
}

/** The Events tab: upcoming soonest first, or past most recent first. */
export function EventsSection({ events, when, base, showDepartment = true }: {
  events: readonly DirectoryEvent[];
  when: EventsWhen;
  base: string;
  showDepartment?: boolean;
}) {
  const { upcoming, past } = splitEvents(events);
  const list = when === 'past' ? past : upcoming;
  const other = when === 'past' ? upcoming : past;
  return (
    <section aria-labelledby="events-heading" className="max-w-[880px]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="events-heading" className="text-xl font-semibold leading-7">{when === 'past' ? 'Past events' : 'Upcoming events'}</h2>
        <SwitchLinks label="Event dates" items={[
          { label: `Upcoming (${upcoming.length})`, href: eventsHref(base, 'upcoming'), current: when === 'upcoming' },
          { label: `Past (${past.length})`, href: eventsHref(base, 'past'), current: when === 'past' },
        ]} />
      </div>
      {list.length > 0
        ? <ol aria-label={count(list.length, when === 'past' ? 'past event' : 'upcoming event')} className="border-t border-border">
          {list.map((event) => <EventRow key={event.id} event={event} showDepartment={showDepartment} />)}
        </ol>
        : <Empty className="border-t border-border" action={other.length > 0
          ? <ViewAll href={eventsHref(base, when === 'past' ? 'upcoming' : 'past')}>
            {when === 'past' ? 'View upcoming events' : 'View past events'}
          </ViewAll>
          : undefined}>
          {events.length === 0 ? 'No events yet.' : when === 'past' ? 'No past events.' : 'No upcoming events.'}
        </Empty>}
    </section>
  );
}

/** The About tab's side panel: the next three events. */
export function UpcomingPanel({ events, base, limit = 3 }: { events: readonly DirectoryEvent[]; base: string; limit?: number }) {
  const { upcoming } = splitEvents(events);
  return (
    <Panel id="upcoming-events" title="Upcoming events"
      action={events.length > 0 ? <ViewAll href={eventsHref(base, 'upcoming')} what="events" /> : undefined}>
      {upcoming.length > 0
        ? <ol>{upcoming.slice(0, limit).map((event) => <EventRow key={event.id} event={event} compact />)}</ol>
        : <Empty>{events.length === 0 ? 'No events yet.' : 'No upcoming events.'}</Empty>}
    </Panel>
  );
}
