import type { Audience, ModelClass, Tier } from '../contracts';

/**
 * Invariant **I7**: distribution never widens.
 *
 * A template version is the ceiling on what any installation of it may do, and
 * `usg_club_policy` is a second ceiling above that. This module is the only
 * place that decides whether a proposed installation stays underneath both.
 *
 * I7 says it runs **on every write and again at run time**, so it is a pure
 * function with no database access: `install`/`updateInstallation` call it
 * before writing, and `effectiveAgent` calls it again when composing the config
 * a run will actually use.
 *
 * A violation becomes a `clamp_violation` `ApiError` (with `cap`) plus an
 * `audit('installation.rejected', {field, allowed})` row — both at the caller,
 * so this stays pure.
 */

export interface ClampInput {
  /** The frozen ceiling: `agent_template_versions`. */
  version: {
    audience: Audience;
    usableBy: string[];
    maxTier: Tier;
    tools: string[];
    modelClasses: ModelClass[];
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
    orgId: string;
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
  extraSourceIds: string[];
  quotaMicro: number | null;
}

export interface ClampViolation {
  /** The field that was too wide — goes into `ApiError.cap.field` and the audit row. */
  field: keyof ClampInput["installation"] | "audience";
  /** What would have been accepted — `ApiError.cap.allowed`. */
  allowed: unknown;
  /** UI copy naming the cap (§11). */
  message: string;
}

export type ClampResult =
  | { ok: true; effective: ClampedConfig }
  | { ok: false; violation: ClampViolation };

/** How wide an audience is. Narrowing is always fine; widening never is. */
const AUDIENCE_BREADTH: Record<Audience, number> = {
  public: 2,
  members: 1,
  positions: 0,
};

const TIER_RANK: Record<Tier, number> = {
  public: 0,
  members: 1,
  officers: 2,
  usg_internal: 3,
};

const deny = (
  field: ClampViolation["field"],
  allowed: unknown,
  message: string,
): ClampResult => ({ ok: false, violation: { field, allowed, message } });

export function clampInstallation(input: ClampInput): ClampResult {
  const { version, installation, club } = input;

  // 1. Audience — may only narrow, and a public one needs USG's permission.
  const audience = installation.audience ?? version.audience;

  if (AUDIENCE_BREADTH[audience] > AUDIENCE_BREADTH[version.audience]) {
    return deny(
      "audience",
      version.audience,
      `This agent is published for ${version.audience}. A club can narrow that, not widen it.`,
    );
  }

  if (audience === "public" && !club.policy.allowPublicAgents) {
    return deny(
      "audience",
      ["members", "positions"],
      "USG has turned off public agents for this club.",
    );
  }

  // 2. Max tier — derived, never stored. A public agent always reads at the
  //    public tier (I4), which is what keeps internal documents in the club
  //    when an agent is opened to the whole campus.
  const maxTier: Tier = audience === "public" ? "public" : version.maxTier;

  if (TIER_RANK[maxTier] > TIER_RANK[version.maxTier]) {
    return deny("audience", version.maxTier, `This agent may not read above ${version.maxTier}.`);
  }

  // 3. usable_by — bounded by the version's list when the version names
  //    positions, otherwise by the positions the club actually has.
  const allowedPositions =
    version.audience === "positions" ? version.usableBy : club.positionSlugs;

  const usableBy =
    installation.usableBy ?? (version.audience === "positions" ? version.usableBy : []);

  const strayPosition = usableBy.find((slug) => !allowedPositions.includes(slug));
  if (strayPosition) {
    return deny(
      "usableBy",
      allowedPositions,
      version.audience === "positions"
        ? `${strayPosition} is not one of the positions this agent was published for.`
        : `${strayPosition} is not a position in this club.`,
    );
  }

  // 4. Model class — inside the version's list and USG's list for the club.
  const allowedClasses = version.modelClasses.filter((c) =>
    club.policy.allowedModelClasses.includes(c),
  );
  const modelClass = installation.modelClass ?? allowedClasses[0] ?? version.modelClasses[0];

  if (!allowedClasses.includes(modelClass)) {
    return deny(
      "modelClass",
      allowedClasses,
      `This agent may run on ${allowedClasses.join(" or ") || "no model class USG allows"}.`,
    );
  }

  // 5. Extra sources — the club's own only. (Tiers are still capped at run
  //    time by RLS; this only stops another club's library being attached.)
  const extraSourceIds = installation.extraSourceIds ?? [];
  const straySource = extraSourceIds.find((id) => !club.ownedSourceIds.includes(id));
  if (straySource) {
    return deny(
      "extraSourceIds",
      club.ownedSourceIds,
      "A club can only add its own documents to an agent.",
    );
  }

  // 6. Installation budget — within the club's own quota.
  const quotaMicro = installation.quotaMicro ?? null;
  if (quotaMicro !== null && quotaMicro > club.quotaMicro) {
    return deny(
      "quotaMicro",
      club.quotaMicro,
      "An agent's budget cannot be larger than the club's monthly quota.",
    );
  }

  return {
    ok: true,
    effective: {
      audience,
      usableBy,
      maxTier,
      // Tools have no override column (§5): they come from the version.
      tools: version.tools,
      modelClass,
      extraSourceIds,
      quotaMicro,
    },
  };
}
