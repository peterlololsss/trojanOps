// Owner: D. Read-only CSV projections of current connector data. Summaries are local demo text.
import { desc, eq } from 'drizzle-orm';
import type { Actor, ConnectorKind, LibraryDocument } from '@/lib/contracts';
import { getDb } from '@/lib/db/client';
import { agentRunsMeta, orgs, sources, users } from '@/lib/db/schema';
import { listLibraryDocuments } from '@/lib/documents/library';
import { requireRosterAdmin } from '@/lib/lifecycle/import';
import { connectorImplementation, getConnectors } from './registry';
import { listInternalSubmissionMetadata } from './applications/mock';
import { buildRosterPreview } from './roster/preview';
import { currentIdentityMembershipPreview } from './identity/member-status';

export type ConnectorPreview = {
  kind: ConnectorKind; title: string; source: string; description: string; summary: string;
  columns: readonly string[]; rows: readonly (readonly string[])[]; isDemo: boolean;
};
export type ConnectorPreviewState =
  | { status: 'ready'; data: ConnectorPreview }
  | { status: 'unavailable'; title: string };

const titles: Record<ConnectorKind, string> = {
  identity: 'Identity', roster: 'Roster', documents: 'Documents', llm: 'Language model', applications: 'Applications',
};

export function connectorKind(value: unknown): ConnectorKind | null {
  return typeof value === 'string' && Object.hasOwn(titles, value) ? value as ConnectorKind : null;
}

/** The service authorizes independently of the page, before reading any connector's dataset. */
export async function loadConnectorPreview(actor: Actor, kind: ConnectorKind): Promise<ConnectorPreviewState> {
  await requireRosterAdmin(actor);
  try {
    return { status: 'ready', data: { kind, title: titles[kind], isDemo: true, ...await dataset(actor, kind) } };
  } catch {
    return { status: 'unavailable', title: titles[kind] };
  }
}

type Dataset = Pick<ConnectorPreview, 'source' | 'description' | 'summary' | 'columns' | 'rows'>;

async function dataset(actor: Actor, kind: ConnectorKind): Promise<Dataset> {
  switch (kind) {
    case 'identity': {
      const membershipPreview = await currentIdentityMembershipPreview();
      return {
        source: 'Current platform accounts and membership history',
        description: 'Membership status is shown separately for each person and organization.',
        summary: membershipPreview.summary,
        columns: ['Person', 'Organization', 'Positions', 'Member status', 'Left on (UTC)'],
        rows: membershipPreview.rows,
      };
    }
    case 'roster': {
      const preview = buildRosterPreview(await getConnectors().roster.fetch());
      const stats = preview.summary;
      return {
        source: 'db/seed/roster.csv',
        description: 'The current import source, not current memberships or predicted sync changes.',
        summary: `This CSV contains ${stats.assignmentCount} source rows for ${stats.personCount} people across ${stats.clubCount} clubs. Each row links a person to a club and a position. Viewing it does not sync the roster.`,
        columns: ['Club', 'Person', 'Position'], rows: preview.rows.map(row => [row.club, row.person, row.position]),
      };
    }
    case 'documents': {
      const clubs = await getDb().select({ id: orgs.id, name: orgs.name }).from(orgs);
      const sourceRows = await getDb().select({ id: sources.id, orgId: sources.orgId }).from(sources);
      const owner = new Map(sourceRows.map(source => [source.id, clubs.find(club => club.id === source.orgId)?.name ?? 'Unknown organization']));
      const visible = new Map<string, LibraryDocument>();
      // Reuse C's library interface: each read recomputes grants and enforces document RLS.
      for (const club of clubs) {
        for (const document of await listLibraryDocuments(actor, club.id)) visible.set(document.id, document);
      }
      const documents = [...visible.values()].sort((a, b) => a.title.localeCompare(b.title));
      return {
        source: 'Current document libraries · filtered by your access',
        description: 'Only document metadata you may read is included. Document bodies remain private.',
        summary: `You can currently read metadata for ${documents.length} documents across these libraries. The table shows each document's organization, source, access tier and version. Restricted documents are excluded.`,
        columns: ['Organization', 'Document', 'Source', 'Access tier', 'Version'],
        rows: documents.map(document => [owner.get(document.sourceId) ?? 'Unknown organization', document.title, document.sourceName, document.tier, String(document.version)]),
      };
    }
    case 'llm': {
      const implementation = connectorImplementation('llm');
      const runs = await getDb().select({
        person: users.displayName, club: orgs.name, model: agentRunsMeta.model,
        status: agentRunsMeta.status, cost: agentRunsMeta.costMicro, startedAt: agentRunsMeta.startedAt,
      }).from(agentRunsMeta)
        .innerJoin(users, eq(users.id, agentRunsMeta.userId))
        .innerJoin(orgs, eq(orgs.id, agentRunsMeta.billedOrgId))
        .orderBy(desc(agentRunsMeta.startedAt), desc(agentRunsMeta.id)).limit(200);
      return {
        source: `Current ${implementation} model connector · latest 200 stored run records`,
        description: 'Actual run metadata only. Prompts, responses and document references are excluded.',
        summary: `The current model connector is ${implementation}. The table contains ${runs.length} of the latest stored run records, with their recorded model, billed club, status and cost. Mock records do not represent real model API calls.`,
        columns: ['Person', 'Billed club', 'Recorded model', 'Status', 'Cost (USD)', 'Started (UTC)'],
        rows: runs.map(run => [run.person, run.club, run.model ?? 'Not recorded', run.status, (run.cost / 1_000_000).toFixed(6), run.startedAt.toISOString()]),
      };
    }
    case 'applications': {
      const entries = listInternalSubmissionMetadata();
      return {
        source: 'Current internal application queue · this server process',
        description: 'Actual submission references only. This in-memory queue resets on server restart.',
        summary: entries.length
          ? `The internal queue currently contains ${entries.length} submission records. The table shows their references, without application contents. These records are not funding approvals.`
          : 'The current internal queue has no submissions. Run-page confirmations currently record a decision without submitting an application. No sample applications have been added.',
        columns: ['Submission reference', 'Storage'], rows: entries.map(entry => [entry.reference, 'Current server process']),
      };
    }
  }
}
