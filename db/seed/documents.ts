// Owner: C (WP-8). Sources and documents (§15); bodies in db/seed/docs/*.md. Never write read_grants.
import { readFileSync } from 'node:fs';
import type { Tier } from '@/lib/contracts';
import { documents, sources, type SourceKind } from '@/lib/db/schema';
import { now } from '@/lib/clock';
import type { SeedDb } from './index';
import { DOCUMENT, ORG, SOURCE, USER } from './ids';

type Org = keyof typeof ORG;

const CLUB_NAMES: Record<Org, string> = { usg: 'USG', startup: 'Startup Club', archery: 'Archery Club', dance: 'Dance Club', hacksc: 'HackSC' };
const USG_SOURCE_NAMES: Partial<Record<SourceKind, string>> = { rulebook: 'USG rulebook', usg_internal: 'USG internal' };
const UPLOADED_BY: Record<Org, string | null> = { usg: USER.avery, startup: USER.sam, archery: null, dance: null, hacksc: USER.sam };

const DOCS: Array<{ id: string; org: Org; sourceId: string; title: string; tier: Tier; file: string }> = [
  { id: DOCUMENT.usgFundingRules, org: 'usg', sourceId: SOURCE.usg.rulebook, title: 'USG Funding Department Guidelines', tier: 'public', file: 'usg-funding-rules.md' },
  { id: DOCUMENT.reviewerNotes, org: 'usg', sourceId: SOURCE.usg.usg_internal, title: 'Reviewer notes', tier: 'usg_internal', file: 'reviewer-notes.md' },
  { id: DOCUMENT.recruitingFaq, org: 'startup', sourceId: SOURCE.startup.public, title: 'Recruiting FAQ', tier: 'public', file: 'recruiting-faq.md' },
  { id: DOCUMENT.minutes20261008, org: 'startup', sourceId: SOURCE.startup.minutes, title: 'Meeting minutes 2026-10-08', tier: 'members', file: 'minutes-2026-10-08.md' },
  { id: DOCUMENT.pastEvents, org: 'startup', sourceId: SOURCE.startup.archive, title: 'Past events and venues', tier: 'members', file: 'past-events.md' },
  { id: DOCUMENT.spring2026Budget, org: 'startup', sourceId: SOURCE.startup.finance, title: 'Spring 2026 budget', tier: 'officers', file: 'spring-2026-budget.md' },
  { id: DOCUMENT.sponsorContacts, org: 'startup', sourceId: SOURCE.startup.finance, title: 'Sponsor contacts', tier: 'officers', file: 'sponsor-contacts.md' },
  { id: DOCUMENT.archeryBudget2026, org: 'archery', sourceId: SOURCE.archery.finance, title: 'Archery budget 2026', tier: 'officers', file: 'archery-budget-2026.md' },
  { id: DOCUMENT.springShowcaseInfo, org: 'dance', sourceId: SOURCE.dance.public, title: 'Spring showcase info', tier: 'public', file: 'spring-showcase-info.md' },
  { id: DOCUMENT.hackscGuide, org: 'hacksc', sourceId: SOURCE.hacksc.public, title: 'HackSC community guide', tier: 'public', file: 'hacksc-guide.md' },
  { id: DOCUMENT.hackscMinutes2026, org: 'hacksc', sourceId: SOURCE.hacksc.minutes, title: 'HackSC organizing meeting — October 8, 2026', tier: 'members', file: 'hacksc-minutes-2026.md' },
  { id: DOCUMENT.hackscHandoff2026, org: 'hacksc', sourceId: SOURCE.hacksc.archive, title: 'HackSC president handoff — 2025–2026', tier: 'members', file: 'hacksc-handoff-2026.md' },
  { id: DOCUMENT.hackscBudget, org: 'hacksc', sourceId: SOURCE.hacksc.finance, title: 'HackSC finance worksheet — 2026', tier: 'officers', file: 'hacksc-budget-2026.md' },
];

/** Adds the judge-demo library while preserving any existing documents and versions. */
export async function seedHackscDocuments(db: SeedDb): Promise<void> {
  const createdAt = now();
  const hackscSources = [
    { id: SOURCE.hacksc.public, kind: 'public', name: 'HackSC · Public' },
    { id: SOURCE.hacksc.minutes, kind: 'minutes', name: 'HackSC · Minutes' },
    { id: SOURCE.hacksc.finance, kind: 'finance', name: 'HackSC · Finance' },
    { id: SOURCE.hacksc.archive, kind: 'archive', name: 'HackSC · Archive' },
  ] satisfies Array<{ id: string; kind: SourceKind; name: string }>;
  await db.insert(sources).values(hackscSources.map((source) => ({
    ...source, orgId: ORG.hacksc, slug: source.kind, createdAt,
  }))).onConflictDoNothing();
  await db.insert(documents).values(DOCS.filter((doc) => doc.org === 'hacksc').map((doc) => ({
    id: doc.id, orgId: ORG.hacksc, sourceId: doc.sourceId, title: doc.title, tier: doc.tier,
    allowedPositions: doc.tier === 'officers' ? ['treasurer'] : [],
    version: 1,
    bodyMd: readFileSync(new URL(`./docs/${doc.file}`, import.meta.url), 'utf8').trim(),
    uploadedBy: USER.sam, createdAt,
  }))).onConflictDoNothing();
}

export async function seedDocuments(db: SeedDb): Promise<void> {
  const createdAt = now();
  await db.insert(sources).values(
    (Object.keys(SOURCE) as Org[]).flatMap((org) =>
      (Object.entries(SOURCE[org]) as Array<[SourceKind, string]>).map(([kind, id]) => ({
        id, orgId: ORG[org], slug: kind, kind, createdAt,
        name: USG_SOURCE_NAMES[kind] ?? `${CLUB_NAMES[org]} · ${kind[0].toUpperCase()}${kind.slice(1)}`,
      })),
    ),
  );
  await db.insert(documents).values(DOCS.map((d) => ({
    id: d.id, orgId: ORG[d.org], sourceId: d.sourceId, title: d.title, tier: d.tier,
    // Every officers document in the seed is shared with the treasurer; the trigger adds the president.
    allowedPositions: d.tier === 'officers' ? ['treasurer'] : [],
    version: 1,
    bodyMd: readFileSync(new URL(`./docs/${d.file}`, import.meta.url), 'utf8').trim(),
    uploadedBy: UPLOADED_BY[d.org],
    createdAt,
  })));
}
