// Owner: B (WP-5). Version ⊗ installation → the config a run actually uses.
//
// Split out from the queries so everything that *decides* anything is pure and testable: the
// database layer picks the rows, this turns them into an EffectiveAgent. It is also where the
// clamps run the second time I7 asks for — on write *and* again at run time — so an installation
// written before its version was narrowed cannot outlive it.
import { AppError, type EffectiveAgent, type ModelClass, type Audience, type Tier } from '../contracts';
import { classOf, DEMO_MODELS, orderedModelIds, type ModelId } from '../gateway/models';
import { clampInstallation, type ClampInput } from './clamps';

export interface ComposeInput {
  template: { slug: string; name: string; status: 'active' | 'retired' };
  /** The version the installation's track resolved to. */
  version: {
    version: number;
    purpose: string;
    audience: Audience;
    usableBy: string[];
    maxTier: Tier;
    tools: string[];
    modelClasses: ModelClass[];
    defaultModelClass: ModelClass;
    modelIds: string[];
    defaultModelId: string;
    systemPrompt: string;
  };
  installation: {
    id: string;
    orgId: string;
    enabled: boolean;
    audience: Audience | null;
    usableBy: string[] | null;
    promptAddendum: string;
    extraSourceIds: string[];
    modelClass: ModelClass | null;
  };
  club: ClampInput['club'];
  /** The version's source kinds, already resolved to source ids in this club. */
  baseSourceIds: string[];
  /** The latest published pack for the version's rule_pack_slug, when it names one. */
  rulePack?: EffectiveAgent['rulePack'];
}

export interface ResolvedAgent extends EffectiveAgent {
  readonly allowedModelClasses: ModelClass[];
  /** The template's models whose class the club and installation allow, in registry order. */
  readonly allowedModelIds: ModelId[];
  /** The template's default model, or the first allowed model of the effective class. */
  readonly defaultModelId: ModelId;
  readonly fixedByClub: boolean;
  readonly limitedByTemplate: boolean;
}

export function composeEffectiveAgent(input: ComposeInput): ResolvedAgent {
  const { template, version, installation, club, baseSourceIds, rulePack } = input;

  const clamped = clampInstallation({
    version: {
      audience: version.audience,
      usableBy: version.usableBy,
      maxTier: version.maxTier,
      tools: version.tools,
      modelClasses: version.modelClasses,
      defaultModelClass: version.defaultModelClass,
    },
    installation: {
      audience: installation.audience,
      usableBy: installation.usableBy,
      modelClass: installation.modelClass,
      extraSourceIds: installation.extraSourceIds,
    },
    club,
  });

  if (!clamped.ok) {
    const { field, allowed, message } = clamped.violation;
    throw new AppError({ code: 'clamp_violation', message, cap: { scope: 'installation', field, allowed } });
  }

  const effective = clamped.effective;
  // Unknown stored ids drop out here; if none is left, the effective class's registry models stand in.
  const offered = orderedModelIds(version.modelIds);
  const fromTemplate = offered.filter((id) => effective.allowedModelClasses.includes(classOf(id)));
  const allowedModelIds = fromTemplate.length ? fromTemplate
    : DEMO_MODELS.filter((m) => m.modelClass === effective.modelClass).map((m) => m.id);
  const defaultModelId = allowedModelIds.find((id) => id === version.defaultModelId && classOf(id) === effective.modelClass)
    ?? allowedModelIds.find((id) => classOf(id) === effective.modelClass)
    ?? allowedModelIds[0];

  // The gateway's step 1 reads this and refuses anything but 'enabled' (contracts.ts), so a
  // retired template or a switched-off installation is reported, not thrown.
  const status: EffectiveAgent['status'] =
    template.status === 'retired' ? 'retired' : installation.enabled ? 'enabled' : 'disabled';

  return {
    installationId: installation.id,
    orgId: installation.orgId,
    templateSlug: template.slug,
    name: template.name,
    templateVersion: version.version,
    status,
    purpose: version.purpose,
    audience: effective.audience,
    usableBy: effective.usableBy,
    maxTier: effective.maxTier,
    // The club's own documents sit alongside the version's kinds; RLS still caps what any one
    // run may read.
    sourceIds: [...new Set([...baseSourceIds, ...effective.extraSourceIds])],
    tools: effective.tools,
    modelClass: effective.modelClass,
    allowedModelClasses: effective.allowedModelClasses,
    allowedModelIds,
    defaultModelId,
    fixedByClub: installation.modelClass !== null,
    // USG would allow a model in this club that the template does not offer.
    limitedByTemplate: DEMO_MODELS.some((m) => club.policy.allowedModelClasses.includes(m.modelClass) && !offered.includes(m.id)),
    systemPrompt: installation.promptAddendum
      ? `${version.systemPrompt}\n\n${installation.promptAddendum}`
      : version.systemPrompt,
    ...(rulePack ? { rulePack } : {}),
  };
}
