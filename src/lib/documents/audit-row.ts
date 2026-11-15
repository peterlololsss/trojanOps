// Owner: C (WP-9). The audit table's row shape and action labels (§12). Pure and client-safe: the
// audit table and its CSV export import this; the server builds rows in audit-view.ts.
import type { AuditAction } from '../contracts';

/** What a document the viewer can't read shows instead of its title (§12). */
export const RESTRICTED_DOCUMENT = 'Restricted document';

/** Sentence-case labels for every audit action. Exhaustive: a new action in the contract fails to
 * compile here until it has a label. */
export const ACTION_LABELS: Record<AuditAction, string> = {
  'agent.run': 'Agent run',
  'run.access': 'Run access',
  'tool.call': 'Tool call',
  'tool.confirm': 'Tool confirmed',
  'authz.denied': 'Access denied',
  'quota.blocked': 'Quota blocked',
  'quota.limit.set': 'Quota limit set',
  'template.publish': 'Template published',
  'template.distribute': 'Template distributed',
  'template.retire': 'Template retired',
  'installation.update': 'Agent updated',
  'installation.rejected': 'Agent change rejected',
  'agent.publish_public': 'Published to all students',
  'org.provision': 'Club provisioned',
  'roster.import': 'Roster imported',
  'connector.sync': 'Connector synced',
  'position.transfer': 'Position transferred',
  'rule_pack.publish': 'Rule pack published',
  'document.upload': 'Document uploaded',
};

export interface AuditRow {
  /** The audit id (audit_events.id), shown as the "Audit id" column. */
  id: number;
  /** ISO timestamp, for sorting. */
  ts: string;
  /** "Nov 15, 2026, 10:42 AM PT". */
  time: string;
  /** The day in Pacific time, "2026-11-15", for the date filter. */
  date: string;
  /** Who acted; null for a system action (seed, scheduled provisioning). */
  actor: { id: string; name: string } | null;
  action: AuditAction;
  actionLabel: string;
  /** The club the row concerns: the agent's club for a run or installation, the target club, else
   * the club the actor was acting in. null when none applies. */
  club: { id: string; name: string } | null;
  /** What the action was about, as words. `restricted` is true only for a document target the viewer
   * can't read; its label is then RESTRICTED_DOCUMENT. */
  target: { type: string; label: string; restricted: boolean };
  /** Documents a run could read (run.access). A document the viewer can't read carries neither its
   * title nor its id (both null): render RESTRICTED_DOCUMENT with a lock icon. */
  documents: Array<{ id: string; title: string } | { id: null; title: null }>;
}
