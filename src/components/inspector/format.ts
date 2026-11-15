// Owner: C. Shared formatting for the run page and its inspector (ui-designer.md "Times and money").
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Micro-USD as "$0.42". */
export const money = (micro: number) => usd.format(micro / 1_000_000);

/** "Read 1 document", "Read 3 documents", "Read no documents". */
export function readCount(n: number): string {
  if (n === 0) return 'Read no documents';
  return `Read ${n} ${n === 1 ? 'document' : 'documents'}`;
}

// Campus time. Built from parts so the output doesn't depend on ICU's spacing (newer ICU puts a
// narrow no-break space before AM/PM).
const PT = 'America/Los_Angeles';
const ptTime = new Intl.DateTimeFormat('en-US', {
  timeZone: PT, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});
const ptDay = new Intl.DateTimeFormat('en-US', { timeZone: PT, year: 'numeric', month: '2-digit', day: '2-digit' });
const part = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((p) => p.type === type)?.value ?? '';

/** An absolute time in Pacific time: "Nov 15, 2026, 10:42 AM PT" ("PT" for both PST and PDT). */
export function auditTime(date: Date): string {
  const p = ptTime.formatToParts(date);
  return `${part(p, 'month')} ${part(p, 'day')}, ${part(p, 'year')}, ${part(p, 'hour')}:${part(p, 'minute')} ${part(p, 'dayPeriod').toUpperCase()} PT`;
}

/** The calendar day in Pacific time, "2026-11-15", for date filters and file names. */
export function ptDate(date: Date): string {
  const p = ptDay.formatToParts(date);
  return `${part(p, 'year')}-${part(p, 'month')}-${part(p, 'day')}`;
}

/** A tool id as words: `submit_to_queue` → "Submit to queue". */
export function humanizeTool(tool: string): string {
  const words = tool.replace(/[_\-.]+/g, ' ').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : tool;
}
