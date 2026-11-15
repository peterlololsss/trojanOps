// Owner: D. Connector implementations are selected once per process (§9, I12).
import { eq, inArray, sql } from 'drizzle-orm';
import type {
  ApplicationSink, ConnectorKind, ConnectorStatus, DocumentSource, IdentityProvider, LLMProvider, RosterSource,
} from '../contracts';
import { now } from '../clock';
import { getDb } from '../db/client';
import { connectors } from '../db/schema';
import { internalApplications } from './applications/mock';
import { noDocumentSource } from './documents/mock';
import { personaIdentity } from './identity/mock';
import { mockLlm } from './llm/mock';
import { csvRoster } from './roster/mock';

export interface Connectors {
  readonly identity: IdentityProvider;
  readonly roster: RosterSource;
  readonly documents: DocumentSource;
  readonly llm: LLMProvider;
  readonly applications: ApplicationSink;
}

const KINDS = ['identity', 'roster', 'documents', 'llm', 'applications'] as const;
const DEFAULTS = {
  identity: 'persona',
  roster: 'csv',
  documents: 'upload',
  llm: 'mock',
  applications: 'internal',
} as const satisfies Record<ConnectorKind, string>;

class ConnectorConfigurationError extends Error {
  constructor(readonly kind: ConnectorKind, readonly implementation: string) {
    super(`CONNECTOR_${kind.toUpperCase()}=${implementation} is not implemented yet`);
    this.name = 'ConnectorConfigurationError';
  }
}

let selection: ReadonlyMap<ConnectorKind, string> | undefined;

export function connectorImplementation(kind: ConnectorKind): string {
  if (!selection) {
    const configured = new Map<ConnectorKind, string>();
    for (const entry of KINDS) {
      const implementation = process.env[`CONNECTOR_${entry.toUpperCase()}`] ?? DEFAULTS[entry];
      if (implementation !== DEFAULTS[entry]) throw new ConnectorConfigurationError(entry, implementation);
      configured.set(entry, implementation);
    }
    selection = configured;
  }
  return selection.get(kind) ?? DEFAULTS[kind];
}

let cached: Connectors | null = null;

export function getConnectors(): Connectors {
  if (cached) return cached;
  connectorImplementation('identity');
  cached = {
    identity: personaIdentity,
    roster: csvRoster,
    documents: noDocumentSource,
    llm: mockLlm,
    applications: internalApplications,
  };
  return cached;
}

/** What the integrations panel shows. Every hackathon implementation is a mock. */
export async function listConnectors(): Promise<ConnectorStatus[]> {
  const selected = KINDS.map((kind) => ({
    kind,
    implementation: connectorImplementation(kind),
    status: 'ok' as const,
    createdAt: now(),
  }));
  await getDb().insert(connectors).values(selected).onConflictDoUpdate({
    target: connectors.kind,
    set: { implementation: sql`excluded.implementation` },
  });
  const stored = await getDb().select().from(connectors).where(inArray(connectors.kind, [...KINDS]));
  return stored.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)).map((entry) => ({
    kind: entry.kind, implementation: entry.implementation, status: entry.status,
    lastSyncAt: entry.lastSyncAt, isMock: true,
  }));
}

export async function recordRosterSync(result: {
  readonly status: ConnectorStatus['status'];
  readonly lastSyncAt?: Date;
  readonly details?: Readonly<Record<string, number>>;
}): Promise<void> {
  await listConnectors();
  await getDb().update(connectors).set({
    status: result.status,
    ...(result.lastSyncAt ? { lastSyncAt: result.lastSyncAt } : {}),
    ...(result.details ? { details: result.details } : {}),
  }).where(eq(connectors.kind, 'roster'));
}
