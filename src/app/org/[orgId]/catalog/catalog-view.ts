// Owner: B (WP-7). Pure view logic and copy for the club catalog: no I/O, so the page and the tests
// share one definition of what each row says and of what the D3 confirmation promises before an
// agent is opened to the whole campus.
import type { CatalogEntry } from '@/lib/distribution';

export const statusLabels: Record<CatalogEntry['status'], string> = {
  enabled: 'Enabled', disabled: 'Disabled', retired: 'Retired by USG',
};

export const distributionLabels: Record<CatalogEntry['distribution'], string> = {
  required: 'Required', default: 'Default', optional: 'Optional',
};

/** Who an installation is for, in the audience words the rest of the product uses. The catalog does
 * not carry `usable_by`, so a positions audience is named rather than listed; `accessLabel` gives
 * the viewer their own positions when they are in it. */
export function audienceLabel(entry: CatalogEntry): string {
  if (entry.audience === 'public') return 'All students';
  if (entry.audience === 'members') return 'All members';
  return 'Named positions';
}

/** What this viewer may do with the row, in one phrase: their audience label when they may run it,
 * and otherwise why not. A switched-off or retired agent is nobody's to run. */
export function accessLabel(entry: CatalogEntry): string {
  if (entry.reasonLabel) return entry.reasonLabel;
  if (entry.status === 'retired') return 'Retired by USG';
  if (entry.status === 'disabled') return 'Turned off in this club';
  return 'Not available to you';
}

export type PublishState =
  /** The president may open it to the campus: D3's button. */
  | 'available'
  /** Already open to all students and running, so there is nothing to publish. */
  | 'published'
  /** USG withdrew the template: publishing it would widen a dead agent. */
  | 'retired'
  /** Not this viewer's to publish. */
  | null;

/**
 * Whether D3's button belongs on this row.
 *
 * An installation counts as published only when it is public **and** switched on: Startup's
 * recruiting Q&A inherits the public audience from its template version while the club keeps it
 * turned off, and that is exactly the row the president publishes on stage.
 */
export function publishState(entry: CatalogEntry, canManage: boolean): PublishState {
  if (!canManage) return null;
  if (entry.isPublic && entry.status === 'enabled') return 'published';
  if (entry.status === 'retired') return 'retired';
  return 'available';
}

export interface PublishConfirmation {
  title: string;
  /** Who gains access, what the agent may read, and what it may spend (§8). */
  points: string[];
  confirm: string;
}

/**
 * The confirmation shown before publishing (§8: it names who gains access and the limit).
 *
 * A public audience clamps the agent's max tier to Public, so the reading sentence is true whatever
 * the installation reads today. The installation's own budget is not in the catalog payload, so the
 * copy states the default §8 applies instead of a figure it cannot know.
 */
export function publishConfirmation(entry: CatalogEntry, orgName: string): PublishConfirmation {
  return {
    title: `Publish ${entry.name} to all students?`,
    points: [
      `Anyone signed in with a USC account can use ${entry.name} from the campus directory, without joining ${orgName}.`,
      `It can read only ${orgName} documents at the Public tier, and never its members-only or officer documents.`,
      `Its runs are billed to ${orgName}. Its monthly budget stays at the figure it already has, or defaults to half of ${orgName}'s monthly quota.`,
      ...(entry.status === 'disabled' ? [`${entry.name} is turned off today. Publishing turns it on.`] : []),
    ],
    confirm: 'Publish to all students',
  };
}

/** The `ApiError` message behind a failed publish — a 422 `clamp_violation` already says what to do
 * — or a plain fallback when the response carries no message. */
export async function publishErrorMessage(response: Response): Promise<string> {
  const failure: unknown = await response.json().catch(() => null);
  if (failure !== null && typeof failure === 'object' && 'message' in failure
    && typeof failure.message === 'string' && failure.message.trim().length > 0) {
    return failure.message;
  }
  return `Publishing failed (${response.status}). Try again, or ask USG whether this club may publish agents.`;
}
