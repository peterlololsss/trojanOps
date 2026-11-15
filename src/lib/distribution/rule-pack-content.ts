// Owner: B. Reads a rule pack's `content` (rules/packs/*.json) for the USG console without trusting
// its shape: a pack that does not match falls back to the JSON view. Pure, so client components
// and tests can import it.

export type RuleGroup = 'deadlines' | 'limits' | 'not-eligible';
export type RuleCheck = 'precheck' | 'reviewer';

export interface PackRule {
  id: string; group: RuleGroup; section: string; title: string;
  value?: number | string; unit?: string; check: RuleCheck; quote: string; example: string; items?: string[];
  /** USG's wording for an exception, shown under the rule. */
  note?: string;
  /** USG's original value, set once USG admins publish a different one; the quote and example still describe it. */
  amendedFrom?: number | string;
}
export interface PackSource {
  title: string; publisher?: string; currentAsOf?: string; retrievedAt?: string; url?: string; pageUrl?: string;
  /** What was corrected while copying, such as typos. */
  edits?: string;
}
export interface PackContent { annualCapUsd?: number; source: PackSource | null; rules: PackRule[]; changeNote?: string }

export const RULE_GROUPS: ReadonlyArray<{ id: RuleGroup; title: string; description: string }> = [
  { id: 'deadlines', title: 'Deadlines', description: 'When to apply, and what to send after the event.' },
  { id: 'limits', title: 'Limits', description: 'How much USG pays per club, per event and per item.' },
  { id: 'not-eligible', title: 'Not eligible', description: 'Expenses USG does not fund, unless its board grants an exception.' },
];
export const CHECKS: Record<RuleCheck, { label: string; description: string }> = {
  precheck: { label: 'Pre-check', description: 'Meant for the agent to flag before the club submits.' },
  reviewer: { label: 'USG reviewer', description: 'A USG reviewer checks it, because it depends on what the club sends later.' },
};
/** Shown where a pack is described while the mock runtime answers (WP-14 brings rule-by-rule checks). */
export const DEMO_RUNTIME_PACK_NOTE = 'Demo runtime: runs show this pack’s version and annual cap; rule-by-rule checks come with the real agent.';
/** The rule whose value the mock runtime reads back as `annualCapUsd` (demo beat D6). */
export const ANNUAL_CAP_RULE = 'annual-cap';

/** The published version a pack's agents read today (or its newest draft when none is published). */
export function currentPackVersion<V extends { status: string }>(versions: readonly V[]): V | undefined {
  return versions.find(v => v.status === 'published') ?? versions[0];
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const optionalStr = (v: unknown) => v === undefined || typeof v === 'string';

function parseRule(raw: unknown): PackRule | null {
  if (!isRecord(raw)) return null;
  const { id, group, section, title, value, unit, check, quote, example, items, note, amendedFrom } = raw;
  if (![id, section, title, quote, example].every(str)) return null;
  if (!RULE_GROUPS.some(g => g.id === group) || (check !== 'precheck' && check !== 'reviewer')) return null;
  if (value !== undefined && !(typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)))) return null;
  if (!optionalStr(unit) || !optionalStr(note)) return null;
  if (amendedFrom !== undefined && !(typeof amendedFrom === 'string' || (typeof amendedFrom === 'number' && Number.isFinite(amendedFrom)))) return null;
  if (items !== undefined && !(Array.isArray(items) && items.every(str))) return null;
  return {
    id: id as string, group: group as RuleGroup, section: section as string, title: title as string,
    ...(value === undefined ? {} : { value: value as number | string }), ...(unit === undefined ? {} : { unit: unit as string }),
    check, quote: quote as string, example: example as string, ...(items === undefined ? {} : { items: items as string[] }),
    ...(typeof note === 'string' && note ? { note } : {}), ...(amendedFrom === undefined ? {} : { amendedFrom: amendedFrom as number | string }),
  };
}
function parseSource(raw: unknown): PackSource | null {
  if (!isRecord(raw) || !str(raw.title)) return null;
  const keys = ['publisher', 'currentAsOf', 'retrievedAt', 'url', 'pageUrl', 'edits'] as const;
  if (!keys.every(k => optionalStr(raw[k]))) return null;
  const source: PackSource = { title: raw.title };
  for (const k of keys) if (typeof raw[k] === 'string') source[k] = raw[k] as string;
  return source;
}

/** The pack's rules, or null when `content` has no `rules` list or any rule is malformed. */
export function parseRulePackContent(content: unknown): PackContent | null {
  if (!isRecord(content) || !Array.isArray(content.rules) || content.rules.length === 0) return null;
  const rules = content.rules.map(parseRule);
  if (rules.some(r => r === null)) return null;
  const ids = new Set(rules.map(r => r!.id));
  if (ids.size !== rules.length) return null;
  return {
    rules: rules as PackRule[], source: parseSource(content.source),
    ...(typeof content.annualCapUsd === 'number' ? { annualCapUsd: content.annualCapUsd } : {}),
    ...(typeof content.changeNote === 'string' && content.changeNote ? { changeNote: content.changeNote } : {}),
  };
}

export const isUsd = (rule: Pick<PackRule, 'unit'>) => /^USD\b/.test(rule.unit ?? '');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** "$8,000", "6", "Wednesday 11:59 PM": the value without its unit. */
export function formatAmount(rule: Pick<PackRule, 'unit'>, value: number | string | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return isUsd(rule) ? usd.format(value) : value.toLocaleString('en-US');
}
/** "per year" for "USD per year"; other units as written. */
export function unitText(rule: Pick<PackRule, 'unit'>): string {
  return (isUsd(rule) ? (rule.unit ?? '').replace(/^USD\s*/, '') : rule.unit ?? '').trim();
}
export function formatRuleValue(rule: PackRule): string {
  if (rule.items) return `${rule.items.length} expense types`;
  return [formatAmount(rule, rule.value), unitText(rule)].filter(Boolean).join(' ');
}

export type RuleValues = Record<string, number | string>;
export const editableRules = (pack: PackContent) => pack.rules.filter(r => r.value !== undefined);
export const ruleValues = (pack: PackContent): RuleValues => Object.fromEntries(editableRules(pack).map(r => [r.id, r.value!]));

/** Why a new value is not acceptable, or null. Counts of weeks, days and events are whole numbers. */
export function valueError(rule: PackRule, value: number | string): string | null {
  if (typeof rule.value === 'string') return String(value).trim() ? null : `Enter a value for ${rule.title}.`;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return `Enter a number of 0 or more for ${rule.title}.`;
  if (!isUsd(rule) && !Number.isInteger(value)) return `Enter a whole number for ${rule.title}, such as ${Math.round(value)}.`;
  return null;
}

export interface ValueChange { id: string; section: string; title: string; before: string; after: string; unit: string }
/** The rules whose value differs, formatted for the review step ("$8,000 → $10,000"). */
export function ruleValueChanges(pack: PackContent, values: RuleValues): ValueChange[] {
  return editableRules(pack).filter(r => r.id in values && values[r.id] !== r.value).map(r => ({
    id: r.id, section: r.section, title: r.title, unit: unitText(r),
    before: formatAmount(r, r.value), after: formatAmount(r, values[r.id]),
  }));
}

/** A rule USG admins changed from USG's published value. */
export const isAmended = (rule: PackRule) => rule.amendedFrom !== undefined && rule.amendedFrom !== rule.value;

function amend(rule: Record<string, unknown>, value: number | string): Record<string, unknown> {
  if (rule.value === value) return rule;
  const original = rule.amendedFrom ?? rule.value;
  const rest = { ...rule }; delete rest.amendedFrom;
  // Back at USG's value: no longer an amendment.
  return original === value || original === undefined ? { ...rest, value } : { ...rest, value, amendedFrom: original };
}

/**
 * The next version's content: everything in `raw` kept, each changed rule's `value` replaced from
 * `values` and marked `amendedFrom` USG's original value (kept across later versions),
 * `annualCapUsd` mirrored from the annual-cap rule, and the change note stored.
 */
export function withRuleValues(raw: Record<string, unknown>, values: RuleValues, changeNote: string): Record<string, unknown> {
  const rules = Array.isArray(raw.rules) ? raw.rules.map(r => isRecord(r) && typeof r.id === 'string' && r.id in values ? amend(r, values[r.id]) : r) : raw.rules;
  const next: Record<string, unknown> = { ...raw, rules };
  const cap = Array.isArray(rules) ? rules.find(r => isRecord(r) && r.id === ANNUAL_CAP_RULE) as Record<string, unknown> | undefined : undefined;
  if (typeof cap?.value === 'number') next.annualCapUsd = cap.value;
  if (changeNote.trim()) next.changeNote = changeNote.trim(); else delete next.changeNote;
  return next;
}

/** "2026-10-21" → "Oct 21, 2026" (or "October 21, 2026" with `long`), without a timezone shift. */
export function calendarDate(iso: string | undefined, long = false): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Intl.DateTimeFormat('en-US', { dateStyle: long ? 'long' : 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}
