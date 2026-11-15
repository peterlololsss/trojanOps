// Frozen after H2. A change needs a PR labelled `contract` (docs/workflow.md).
// Spec: docs/architecture.md §6.

export type Grant = '*' | `${string}:*` | `${string}:${string}`;
export type Tier = 'public' | 'members' | 'officers' | 'usg_internal';
export type Audience = 'public' | 'members' | 'positions';
export type ModelClass = 'standard' | 'economy';
export type AccessCell = 'allowed' | 'not_granted' | 'outside_sources' | 'above_max_tier';

export interface Actor {
  userId: string | null;          // null only on public pages before sign-in; runs require a user
  activeOrgId: string | null;     // null = acting as a student outside any club
  positions: string[];            // slugs held in activeOrgId only
  grants: Grant[];                // grantsFor(); never persisted
}

export interface EffectiveAgent {
  installationId: string;
  orgId: string;                  // club that owns the installation; billed for every run
  templateSlug: string;
  name: string;
  templateVersion: number;
  status: 'enabled' | 'disabled' | 'retired';  // gateway step 1 refuses anything but 'enabled'
  purpose: string;
  audience: Audience;
  usableBy: string[];             // position slugs; empty unless audience = 'positions'
  maxTier: Tier;
  sourceIds: string[];
  tools: string[];
  modelClass: ModelClass;
  systemPrompt: string;
  rulePack?: { slug: string; version: number; label: string; content: unknown };
}

// distribution: positions are read in agent.orgId, not in the actor's active org.
// Implemented in src/lib/distribution/effective-config.ts.
export type CanUseResult =
  | { ok: true; reason: 'public' | 'members' | { position: string } }
  | { ok: false };
export type CanUse = (userId: string, agent: EffectiveAgent) => Promise<CanUseResult>;

export interface AccessibleDocument { id: string; title: string; tier: Tier; bodyMd: string }

// The document library (C → B club home): documents the actor can read in one club.
export interface LibraryDocument {
  id: string;
  title: string;
  tier: Tier;
  sourceId: string;
  sourceName: string;
  version: number;
  createdAt: Date;
}

export interface AgentRuntime {
  run(agent: EffectiveAgent, actor: Actor, input: string, ctx: {
    runId: string;
    accessibleDocuments: AccessibleDocument[];
  }): Promise<AgentResult>;
}

export interface AgentResult {
  reply: string;
  citations: Array<{ documentId: string; quote: string }>;
  proposedActions: Array<{ tool: string; args: unknown }>;
  usage: { model: string; inputTokens: number; outputTokens: number; costMicro?: number };
}

export interface RunInspector {
  runGrants: Array<{ grant: Grant; label: string }>;      // label e.g. "Startup Club · Treasurer"
  sources: Array<{ id: string; name: string }>;
  permitted: Array<{ id: string; title: string; tier: Tier }>;
  readInRun: Array<{ id: string; title: string }>;        // cited documents
  blocked?: Array<{ id: string; title: string | null; reason: AccessCell }>;  // only when the viewer manages the club; null title = "Restricted document"
  templateVersion: number;
  rulePack?: { label: string; version: number };
  billedClub: string;
  costMicro: number;
  quotaRemainingMicro: Record<string, number>;
  auditEventId: number;
}

export interface RunResult {
  runId: string;
  reply: string;
  citations: Array<{ documentId: string; quote: string }>;
  pendingActions: Array<{ id: string; tool: string }>;
  inspector: RunInspector;
}

export interface PreviewMatrix {
  subjects: Array<{ key: string; label: string }>;          // positions, "Member", "Any signed-in student"
  documents: Array<{ id: string; title: string; tier: Tier; source: string }>;
  cells: Record<string, Record<string, AccessCell>>;        // subjectKey → documentId → cell
}

// Distribution read models (B → D)
export interface AgentListing {
  installationId: string;
  orgId: string;
  orgName: string;
  templateSlug: string;
  name: string;
  purpose: string;
  audience: Audience;
  reasonLabel: string;            // "All students", "All members", or position names ("Treasurer, President")
  templateVersion: number;
}

export interface MyAgentsClub {
  orgId: string;
  orgName: string;
  positionNames: string[];        // the user's positions in this club
  agents: AgentListing[];
}

// Quota (§11)
export type QuotaScope = 'platform' | 'org' | 'member' | 'installation' | 'student_daily';

export interface QuotaTarget {
  scope: QuotaScope;
  orgId?: string;
  userId?: string;
  installationId?: string;
}

export interface QuotaRemaining {
  scope: QuotaScope;
  limitMicro: number;
  spentMicro: number;
  remainingMicro: number;
}

// Audit (§12)
export type AuditAction =
  | 'agent.run' | 'run.access' | 'tool.call' | 'tool.confirm' | 'tool.reject'
  | 'authz.denied' | 'quota.blocked' | 'quota.limit.set'
  | 'template.publish' | 'template.distribute' | 'template.retire'
  | 'installation.update' | 'installation.rejected' | 'agent.publish_public'
  | 'org.provision' | 'roster.import' | 'connector.sync' | 'position.transfer'
  | 'rule_pack.publish' | 'document.upload';

export interface AuditEvent {
  actorUserId: string | null;
  actingOrgId: string | null;
  runId?: string;
  installationId?: string;
  targetType: string;
  targetId: string;
  details: Record<string, string | number | boolean | null | string[] | number[]>;  // ids and numbers only (I8)
}

export interface AuditEntry extends AuditEvent {
  id: number;
  ts: Date;
  action: AuditAction;
}

export interface ApiError {
  code: 'unauthenticated' | 'forbidden' | 'quota_exceeded' | 'clamp_violation' | 'not_found' | 'invalid';
  message: string;                                          // UI copy, §11
  cap?: { scope: string; limitMicro?: number; spentMicro?: number; field?: string; allowed?: unknown };
}

const STATUS: Record<ApiError['code'], number> = {
  unauthenticated: 401,
  forbidden: 403,
  quota_exceeded: 429,
  clamp_violation: 422,
  not_found: 404,
  invalid: 400,
};

/** Thrown by services; `route()` in src/lib/api.ts turns it into a JSON ApiError. */
export class AppError extends Error {
  readonly status: number;
  constructor(readonly error: ApiError) {
    super(error.message);
    this.name = 'AppError';
    this.status = STATUS[error.code];
  }
}

// Connectors (§9)
export type ConnectorKind = 'identity' | 'roster' | 'documents' | 'llm' | 'applications';

export interface ConnectorStatus {
  kind: ConnectorKind;
  implementation: string;         // "mock", "csv", "persona", …
  isMock: boolean;
  status: 'ok' | 'degraded' | 'down';
  lastSyncAt: Date | null;
}

export interface IdentityProvider { currentUserId(req: Request): Promise<string | null> }
export interface RosterRow {
  orgSlug: string;
  orgName: string;
  externalUserId: string;
  userDisplayName: string;
  position: string;
}
export interface RosterSource { fetch(): Promise<RosterRow[]> }
export interface DocumentSource {           // imports from external stores; uploads go through documents.library
  list(orgId: string): Promise<Array<{ externalId: string; title: string }>>;
  read(externalId: string): Promise<{ title: string; bodyMd: string }>;
}
export interface ApplicationSink { submit(application: unknown): Promise<{ externalId: string }> }
export interface LLMProvider {              // used by the real runtime (WP-13)
  complete(req: unknown): Promise<unknown>;
  priceUsdPerMTok(model: string): { input: number; output: number };
}
