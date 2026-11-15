// Owner: D (WP-11). Pure view logic and copy for the directory pages: no I/O, so pages, client
// components and tests share one definition of a date block, a time range and a funding line.
import { auditTime } from '@/components/inspector/format';
import type { DirectoryEvent, FundingStatus, FundingSummary } from './types';

const PT = 'America/Los_Angeles';
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: PT, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});
const part = (date: Date, type: Intl.DateTimeFormatPartTypes) =>
  parts.formatToParts(date).find((p) => p.type === type)?.value ?? '';
const clock = (date: Date) => `${part(date, 'hour')}:${part(date, 'minute')} ${part(date, 'dayPeriod').toUpperCase()}`;

/** The calendar tile beside an event: { month: "NOV", day: "20", weekday: "Fri" } in Pacific time. */
export function dateBlock(iso: string): { month: string; day: string; weekday: string } {
  const date = new Date(iso);
  return { month: part(date, 'month').toUpperCase(), day: part(date, 'day'), weekday: part(date, 'weekday') };
}

/** "Fri, Nov 20, 2026, 6:30–9:00 PM PT"; the day is repeated when an event runs past midnight. */
export function eventTime(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = (d: Date) => `${part(d, 'weekday')}, ${part(d, 'month')} ${part(d, 'day')}, ${part(d, 'year')}`;
  if (day(start) !== day(end)) return `${day(start)}, ${clock(start)} – ${day(end)}, ${clock(end)} PT`;
  const samePeriod = part(start, 'dayPeriod') === part(end, 'dayPeriod');
  const from = samePeriod ? `${part(start, 'hour')}:${part(start, 'minute')}` : clock(start);
  return `${day(start)}, ${from}–${clock(end)} PT`;
}

/** "Nov 13, 2026, 4:20 PM PT". */
export const postedTime = (iso: string) => auditTime(new Date(iso));

/** Short date for table cells: "Nov 20". */
export const shortDate = (iso: string) => `${part(new Date(iso), 'month')} ${part(new Date(iso), 'day')}`;

/** Whole dollars for budgets and funding: 1_200_000_000 → "$1,200". */
export const dollars = (micro: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(micro / 1_000_000);

export const FUNDING_LABEL: Record<FundingStatus, string> = {
  approved: 'USG funded',
  pending: 'Funding pending',
  none: 'No USG funding',
};

/** "USG funded · $1,200", "Funding pending · $500", or "No USG funding". */
export function fundingText(funding: NonNullable<DirectoryEvent['funding']>): string {
  return funding.status === 'none' ? FUNDING_LABEL.none : `${FUNDING_LABEL[funding.status]} · ${dollars(funding.amountMicro)}`;
}

/** "$1,800 of $8,000 this year" and "2 of 4 funded events this semester". */
export function fundingLines(summary: FundingSummary): { year: string; semester: string; pending: string | null } {
  return {
    year: `${dollars(summary.approvedMicro)} of ${dollars(summary.capMicro)} this year`,
    semester: `${summary.fundedEvents} of ${summary.eventLimit} funded events this semester`,
    pending: summary.pendingMicro > 0 ? `${dollars(summary.pendingMicro)} pending` : null,
  };
}

/** Upcoming events soonest first, past events most recent first. */
export function splitEvents(events: readonly DirectoryEvent[]): { upcoming: DirectoryEvent[]; past: DirectoryEvent[] } {
  const byStart = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { upcoming: byStart.filter((e) => !e.past), past: byStart.filter((e) => e.past).reverse() };
}

/** "Taylor" → "T", "Startup Club" → "SC". At most two letters. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}

export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "pilot" → "Pilot cohort". */
export function cohortLabel(slug: string): string {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return words ? `${words[0]!.toUpperCase()}${words.slice(1)} cohort` : 'Cohort';
}

/** USG funding approved this year against the cap: "$1,800 of $8,000". */
export const fundingUsed = (summary: Pick<FundingSummary, 'approvedMicro' | 'capMicro'>) =>
  `${dollars(summary.approvedMicro)} of ${dollars(summary.capMicro)}`;

/** A department's semester budget: "$1,650 of $2,600 committed". */
export const budgetText = (budget: { allocatedMicro: number; committedMicro: number }) =>
  `${dollars(budget.committedMicro)} of ${dollars(budget.allocatedMicro)} committed`;

/** 0–100 for a bar's fill; nothing allocated reads as empty. */
export const percentOf = (part: number, whole: number) =>
  whole > 0 ? Math.min(100, Math.max(0, Math.round((part / whole) * 100))) : 0;
