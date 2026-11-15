// Owner: A (WP-4). Quota periods (§11): the calendar month in America/Los_Angeles for club, member,
// installation and platform limits; PT midnight for the student daily cap. Boundaries come from the
// PT calendar date, never a fixed offset: 2026-11-01 00:00 is PDT while mid-November is PST.
const TZ = 'America/Los_Angeles';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function ptParts(at: Date): { year: number; month: number; day: number; asUtcMs: number } {
  const p = Object.fromEntries(formatter.formatToParts(at).map((x) => [x.type, Number(x.value)]));
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    asUtcMs: Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second),
  };
}

/** PT's offset from UTC at an instant, in ms (negative). */
function offsetMs(at: Date): number {
  return ptParts(at).asUtcMs - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant of 00:00 PT on a PT calendar date. The second pass corrects a guess that fell on the
 * other side of a DST change. */
function ptMidnight(year: number, month: number, day: number): Date {
  const wall = Date.UTC(year, month - 1, day);
  const first = wall - offsetMs(new Date(wall));
  return new Date(wall - offsetMs(new Date(first)));
}

/** Start of the quota period containing `at`: the first of the PT month, or PT midnight. */
export function periodStart(kind: 'month' | 'day', at: Date): Date {
  const { year, month, day } = ptParts(at);
  return ptMidnight(year, month, kind === 'month' ? 1 : day);
}

export function periodEnd(kind: 'month' | 'day', at: Date): Date {
  const { year, month, day } = ptParts(at);
  return kind === 'month' ? ptMidnight(year, month + 1, 1) : ptMidnight(year, month, day + 1);
}
