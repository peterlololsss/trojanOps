'use client';

// Owner: B. One rule pack on /usg/rule-packs: its source, the templates that use it, its rules
// grouped as USG's guidelines group them, and its version history.
import Link from 'next/link';
import { Check, ClipboardCheck, ExternalLink, PenLine, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  calendarDate, CHECK_LABELS, currentPackVersion, formatAmount, formatRuleValue, isAmended, parseRulePackContent, RULE_GROUPS,
  type PackContent, type PackRule,
} from '@/lib/distribution/rule-pack-content';
import type { UsgPack, UsgPackUser } from '@/lib/distribution/usg-view';
import { absoluteTime } from '../templates/console-ui';
import { audienceLabel, plural } from '../templates/template-config';
import { PublishPackDialog } from './publish-pack-dialog';

const factRow = 'grid gap-1 py-2 md:grid-cols-[160px_minmax(0,1fr)] md:gap-4';

export function UsedBy({ users }: { users: UsgPackUser[] }) {
  if (!users.length) return <span className="text-muted-foreground">None</span>;
  // Club-built templates have no page in the USG console, so only USG's own templates link.
  return <ul className="space-y-1">{users.map(u => <li key={u.templateId}>
    {u.global ? <Link className="text-primary underline" href={`/usg/templates/${u.templateId}`}>{u.name}</Link> : u.name}
    {` · ${plural(u.installedCount, 'club')} · ${audienceLabel(u.audience, u.usableBy)}`}
  </li>)}</ul>;
}

export function CheckedBy({ check }: { check: PackRule['check'] }) {
  return check === 'precheck'
    ? <Badge variant="info"><ClipboardCheck aria-hidden="true" />{CHECK_LABELS.precheck}</Badge>
    : <Badge><UserCheck aria-hidden="true" />{CHECK_LABELS.reviewer}</Badge>;
}

/** "Amended · USG: $8,000": the value differs from USG's published one. */
export function AmendedChip({ rule }: { rule: PackRule }) {
  return <Badge variant="attention" className="mt-1"><PenLine aria-hidden="true" />{`Amended · USG: ${formatAmount(rule, rule.amendedFrom)}`}</Badge>;
}

function RuleRows({ rule }: { rule: PackRule }) {
  const amended = isAmended(rule); const extra = !!(rule.items || rule.note);
  return <>
    <TableRow className={extra ? 'border-b-0 align-top hover:bg-transparent' : 'align-top hover:bg-transparent'}>
      <TableCell className="whitespace-nowrap text-muted-foreground">{rule.section}</TableCell>
      <TableCell>
        <span className="font-semibold">{rule.title}</span>
        <details className="mt-1"><summary className="cursor-pointer text-xs text-primary">{amended ? 'USG wording (before amendment)' : 'USG wording'}</summary>
          <blockquote className="mt-1 border-l-2 border-border pl-2 text-xs leading-4 text-muted-foreground">“{rule.quote}”</blockquote></details>
      </TableCell>
      <TableCell className="tabular-nums">{formatRuleValue(rule) || <span className="text-muted-foreground">—</span>}
        {amended && <span className="block"><AmendedChip rule={rule} /></span>}</TableCell>
      <TableCell><CheckedBy check={rule.check} /></TableCell>
    </TableRow>
    {extra && <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="space-y-2 pt-0 pb-3">
      {rule.items && <ul aria-label={rule.title} className="list-disc columns-1 gap-8 pl-5 md:columns-2 xl:columns-3">{rule.items.map(item => <li key={item} className="break-inside-avoid">{item}</li>)}</ul>}
      {rule.note && <p><span className="font-semibold">Exception: </span>{rule.note}</p>}
    </TableCell></TableRow>}
  </>;
}

export function RuleGroups({ content, idPrefix }: { content: PackContent; idPrefix: string }) {
  return <div className="space-y-6">
    {RULE_GROUPS.map(group => {
      const rules = content.rules.filter(r => r.group === group.id);
      if (!rules.length) return null;
      return <section key={group.id} aria-labelledby={`${idPrefix}-group-${group.id}`} className="space-y-2">
        <h3 id={`${idPrefix}-group-${group.id}`} className="text-base font-semibold leading-6">{group.title} <span className="font-normal text-muted-foreground">· {plural(rules.length, 'rule')}</span></h3>
        <div className="rounded-md border border-border">
          <Table className="min-w-[760px] table-fixed">
            <colgroup><col className="w-[120px]" /><col className="w-[44%]" /><col /><col className="w-[160px]" /></colgroup>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Section</TableHead><TableHead>Rule</TableHead><TableHead>Value</TableHead><TableHead>Checked by</TableHead></TableRow></TableHeader>
            <TableBody>{rules.map(rule => <RuleRows key={rule.id} rule={rule} />)}</TableBody>
          </Table>
        </div>
      </section>;
    })}
  </div>;
}

function VersionHistory({ pack }: { pack: UsgPack }) {
  return <details className="border-t border-border pt-4">
    <summary className="cursor-pointer font-semibold text-primary">Version history ({pack.versions.length})</summary>
    <div className="mt-3 rounded-md border border-border"><Table className="min-w-[720px]">
      <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-right">Version</TableHead><TableHead>Label</TableHead><TableHead>Status</TableHead><TableHead>Published</TableHead><TableHead>Change note</TableHead></TableRow></TableHeader>
      <TableBody>{pack.versions.map(v => {
        const note = typeof v.content.changeNote === 'string' && v.content.changeNote ? v.content.changeNote : v.version === 1 ? 'First version.' : '—';
        return <TableRow key={v.version}><TableCell className="text-right tabular-nums">v{v.version}</TableCell><TableCell>{v.label}</TableCell>
          <TableCell>{v.status === 'published' ? <Badge variant="success"><Check aria-hidden="true" />Published</Badge> : <Badge>Draft</Badge>}</TableCell>
          <TableCell className="whitespace-nowrap font-mono text-xs">{absoluteTime(v.publishedAt)}</TableCell><TableCell>{note}</TableCell></TableRow>;
      })}</TableBody>
    </Table></div>
  </details>;
}

export function RulePackCard({ pack }: { pack: UsgPack }) {
  const current = currentPackVersion(pack.versions); const content = parseRulePackContent(current?.content);
  const source = content?.source; const asOf = calendarDate(source?.currentAsOf);
  return <Card role="region" className="space-y-4 p-4" aria-labelledby={`pack-${pack.slug}`}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h2 id={`pack-${pack.slug}`} className="text-xl font-semibold leading-7">{current?.label ?? pack.slug}</h2>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span className="font-mono text-xs">{pack.slug}</span>
          {current?.status === 'published' ? <Badge variant="success"><Check aria-hidden="true" />Published v{current.version}</Badge> : <Badge>No published version</Badge>}
          <span className="font-mono text-xs">{absoluteTime(current?.publishedAt ?? null)}</span>
        </p>
      </div>
      <PublishPackDialog pack={pack} />
    </div>
    <dl className="divide-y divide-border border-y border-border">
      {source && <div className={factRow}><dt className="text-muted-foreground">Source</dt><dd>
        {source.url ? <a className="inline-flex items-center gap-1 text-primary underline" href={source.url} target="_blank" rel="noreferrer">{source.title}{asOf ? `, current as of ${asOf}` : ''}<ExternalLink aria-hidden="true" className="size-3" /><span className="sr-only">(opens in a new tab)</span></a>
          : <span>{source.title}{asOf ? `, current as of ${asOf}` : ''}</span>}
        {source.publisher && <span className="text-muted-foreground"> · {source.publisher}</span>}
        {source.pageUrl && <> · <a className="text-primary underline" href={source.pageUrl} target="_blank" rel="noreferrer">USG web page<span className="sr-only"> (opens in a new tab)</span></a></>}
      </dd></div>}
      <div className={factRow}><dt className="text-muted-foreground">Used by</dt><dd><UsedBy users={pack.usedBy} /></dd></div>
    </dl>
    {content ? <RuleGroups content={content} idPrefix={pack.slug} />
      : <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">{JSON.stringify(current?.content ?? {}, null, 2)}</pre>}
    <VersionHistory pack={pack} />
  </Card>;
}
