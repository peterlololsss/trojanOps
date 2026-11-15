// Owner: B (WP-7). Pure view logic and copy for the club catalog: no I/O, so the page and the tests
// share one definition of what each row says and of what the D3 confirmation promises before an
// agent is opened to the whole campus.
import type { CatalogEntry } from '@/lib/distribution';
import { positionName } from '@/lib/distribution/labels';
import { usd } from '@/lib/gateway/quota-messages';

export const statusLabels: Record<CatalogEntry['status'], string> = {
  enabled: 'Enabled', disabled: 'Disabled', retired: 'Retired by USG',
};

export const distributionLabels: Record<CatalogEntry['distribution'], string> = {
  required: 'Required', default: 'Default', optional: 'Optional',
};

/** Who an installation is for, in the audience words the rest of the product uses: "All students",
 * "All members", or the position names ("Treasurer, President"). A positions audience with no
 * positions left on it is nobody's, which the fallback says rather than naming an empty list. */
export function audienceLabel(entry: CatalogEntry): string {
  if (entry.audience === 'public') return 'All students';
  if (entry.audience === 'members') return 'All members';
  return entry.usableBy.length > 0 ? entry.usableBy.map(positionName).join(', ') : 'No positions';
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
  /** An internal agent, or a club USG does not let publish: the action could only fail. */
  | 'unavailable'
  /** Not this viewer's to publish. */
  | null;

/**
 * Whether D3's button belongs on this row.
 *
 * An installation counts as published only when it is public **and** switched on: Startup's
 * recruiting Q&A inherits the public audience from its template version while the club keeps it
 * turned off, and that is exactly the row the president publishes on stage.
 *
 * Everything else turns on the service's `canPublishPublic`, which reads the template *version's*
 * audience and the club's policy. The effective audience cannot stand in for it: a club that
 * narrowed a public version to members may still publish it back, while `handoff`, whose version is
 * members-wide, would only ever come back as a clamp violation.
 */
export function publishState(entry: CatalogEntry, canManage: boolean, clubLimitMicro = 1): PublishState {
  if (!canManage) return null;
  if (entry.isPublic && entry.status === 'enabled') return 'published';
  if (entry.status === 'retired') return 'retired';
  // A club with no monthly quota cannot give the agent a budget, and the service refuses the
  // publish outright — so the action is not offered rather than offered and failed.
  if (clubLimitMicro <= 0) return 'unavailable';
  return entry.canPublishPublic ? 'available' : 'unavailable';
}

export interface PublishBudget {
  micro: number;
  /** `own`: the budget the installation already carries. `half`: what publishing will set, half of
   * the club's monthly quota (§8). */
  source: 'own' | 'half';
}

/** The monthly budget the published agent will run on. */
export function publishBudget(entry: CatalogEntry, clubLimitMicro: number): PublishBudget {
  return entry.limitMicro !== null
    ? { micro: entry.limitMicro, source: 'own' }
    : { micro: Math.floor(clubLimitMicro / 2), source: 'half' };
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
 * the installation reads today. The budget is named as a figure: the one the agent already carries,
 * or the half of the club's quota publishing will give it. A club with no quota is refused by the
 * service, so the copy says that instead of offering $0.00.
 */
export function publishConfirmation(
  entry: CatalogEntry, orgName: string, clubLimitMicro: number,
): PublishConfirmation {
  const budget = publishBudget(entry, clubLimitMicro);
  return {
    title: `Publish ${entry.name} to all students?`,
    points: [
      `Anyone signed in with a USC account can use ${entry.name} from ${orgName}'s page in the directory, without joining ${orgName}.`,
      `It can read only ${orgName} documents at the Public tier, and never its members-only or officer documents.`,
      budget.micro <= 0
        ? `${orgName} has no monthly AI quota yet, so publishing is refused until USG sets one.`
        : budget.source === 'own'
          ? `Its runs are billed to ${orgName}, against the monthly budget of ${usd(budget.micro)} it already has.`
          : `Its runs are billed to ${orgName}, on a monthly budget of ${usd(budget.micro)}: half of the club's ${usd(clubLimitMicro)} quota.`,
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
