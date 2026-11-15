// Owner: B (WP-5). Invariant I7: distribution never widens. A template version is the ceiling on
// what any installation of it may do, and usg_club_policy is a second ceiling above that. This is
// the only place that decides whether a proposed installation stays underneath both.
//
// I7 runs it on every write and again at run time, so it is pure and touches no database:
// install/updateInstallation call it before writing, and effectiveAgent calls it again when
// composing the config a run will use.
//
// A violation becomes a clamp_violation ApiError (with cap) plus an
// audit('installation.rejected', {field, allowed}) row — both at the caller, so this stays pure.
import type { Audience, ModelClass, Tier } from '../contracts';

export interface ClampInput {
  /** The frozen ceiling: agent_template_versions. */
  version: {
    audience: Audience;
    usableBy: string[];
    maxTier: Tier;
    tools: string[];
    modelClasses: ModelClass[];
    defaultModelClass: ModelClass;
  };
  /** The club's overrides. Every field absent means "inherit the version". */
  installation: {
    audience?: Audience | null;
    usableBy?: string[] | null;
    modelClass?: ModelClass | null;
    extraSourceIds?: string[] | null;
    quotaMicro?: number | null;
  };
  /** The club and what USG allows it. */
  club: {
    policy: { allowedModelClasses: ModelClass[]; allowPublicAgents: boolean };
    /** Position slugs that exist in this club. */
    positionSlugs: string[];
    /** Document sources this club owns; an extra source must be one of these. */
    ownedSourceIds: string[];
    /** The club's own monthly quota: an installation's budget cannot exceed it. */
    quotaMicro: number;
  };
}

export interface ClampedConfig {
  audience: Audience;
  usableBy: string[];
  maxTier: Tier;
  tools: string[];
  modelClass: ModelClass;
  allowedModelClasses: ModelClass[];
  extraSourceIds: string[];
  quotaMicro: number | null;
}

export interface ClampViolation {
  /** The field that was too wide — ApiError.cap.field and the audit row. */
  field: keyof ClampInput['installation'] | 'audience';
  /** What would have been accepted — ApiError.cap.allowed. Kept to the types AuditEvent.details allows (I8). */
  allowed: string | number | string[];
  /** UI copy naming the cap (§11). */
  message: string;
}

export type ClampResult =
  | { ok: true; effective: ClampedConfig }
  | { ok: false; violation: ClampViolation };

/** How wide an audience is. Narrowing is always fine; widening never is. */
const AUDIENCE_BREADTH: Record<Audience, number> = { public: 2, members: 1, positions: 0 };

const TIER_RANK: Record<Tier, number> = { public: 0, members: 1, officers: 2, usg_internal: 3 };

const deny = (
  field: ClampViolation['field'],
  allowed: ClampViolation['allowed'],
  message: string,
): ClampResult => ({ ok: false, violation: { field, allowed, message } });

export function clampInstallation(input: ClampInput): ClampResult {
  const { version, installation, club } = input;

  // 1. Audience — may only narrow, and a public one needs USG's permission.
  const audience = installation.audience ?? version.audience;

  if (AUDIENCE_BREADTH[audience] > AUDIENCE_BREADTH[version.audience]) {
    return deny(
      'audience',
      version.audience,
      `This agent is published for ${version.audience}. A club can narrow that, not widen it.`,
    );
  }

  if (audience === 'public' && !club.policy.allowPublicAgents) {
    return deny('audience', ['members', 'positions'], 'USG has turned off public agents for this club.');
  }

  // 2. Max tier — derived, never stored. I4 caps the *version* first: a version published to
  //    all students can only ever read at the public tier, so narrowing the audience afterwards
  //    must not hand the installation officer-tier reads it never had.
  const versionCeiling: Tier = version.audience === 'public' ? 'public' : version.maxTier;
  const maxTier: Tier = audience === 'public' ? 'public' : versionCeiling;

  if (TIER_RANK[maxTier] > TIER_RANK[versionCeiling]) {
    return deny('audience', versionCeiling, `This agent may not read above ${versionCeiling}.`);
  }

  // 3. usable_by — only meaningful for a positions audience (contracts.ts: empty otherwise),
  //    and bounded by the version's list when the version names positions, otherwise by the
  //    positions the club actually has.
  const allowedPositions = version.audience === 'positions' ? version.usableBy : club.positionSlugs;

  const usableBy =
    audience === 'positions'
      ? (installation.usableBy ?? (version.audience === 'positions' ? version.usableBy : []))
      : [];

  if (audience === 'positions' && usableBy.length === 0) {
    return deny('usableBy', allowedPositions, 'Name at least one position that can use this agent.');
  }

  const strayPosition = usableBy.find((slug) => !allowedPositions.includes(slug));
  if (strayPosition) {
    return deny(
      'usableBy',
      allowedPositions,
      version.audience === 'positions'
        ? `${strayPosition} is not one of the positions this agent was published for.`
        : `${strayPosition} is not a position in this club.`,
    );
  }

  // 4. Model class — inside the version's list and USG's list for the club. With no override the
  //    version's default_model_class wins (§5), falling back only if USG forbids it.
  const allowedClasses = version.modelClasses.filter((c) => club.policy.allowedModelClasses.includes(c));

  if (allowedClasses.length === 0) {
    return deny('modelClass', version.modelClasses, 'USG allows none of the model classes this agent was published for.');
  }

  const modelClass =
    installation.modelClass ??
    (allowedClasses.includes(version.defaultModelClass) ? version.defaultModelClass : allowedClasses[0]);

  if (!allowedClasses.includes(modelClass)) {
    return deny('modelClass', allowedClasses, `This agent may run on ${allowedClasses.join(' or ')}.`);
  }

  // 5. Extra sources — the club's own only. (Tiers are still capped at run time by RLS; this only
  //    stops another club's library being attached.)
  const extraSourceIds = installation.extraSourceIds ?? [];
  const straySource = extraSourceIds.find((id) => !club.ownedSourceIds.includes(id));
  if (straySource) {
    return deny('extraSourceIds', club.ownedSourceIds, 'A club can only add its own documents to an agent.');
  }

  // 6. Installation budget — within the club's own quota.
  // TODO(verify): §11 says every public installation has an installation limit, but the default
  // (half the club's monthly quota) is applied by publishToAllStudents, so this accepts a public
  // installation with quotaMicro null. Enforcing it here would reject run-time clamps of rows
  // publishToAllStudents has not touched yet; confirm the enforcement point with the team.
  const quotaMicro = installation.quotaMicro ?? null;
  if (quotaMicro !== null && quotaMicro > club.quotaMicro) {
    return deny('quotaMicro', club.quotaMicro, "An agent's budget cannot be larger than the club's monthly quota.");
  }

  return {
    ok: true,
    effective: {
      audience,
      usableBy: [...usableBy],
      maxTier,
      // Tools have no override column (§5): they come from the version.
      tools: [...version.tools],
      modelClass,
      allowedModelClasses: installation.modelClass ? [modelClass] : allowedClasses,
      extraSourceIds: [...extraSourceIds],
      quotaMicro,
    },
  };
}
