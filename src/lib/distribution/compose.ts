// Owner: B (WP-5). Version ⊗ installation → the config a run actually uses.
//
// Split out from the queries so everything that *decides* anything is pure and testable: the
// database layer picks the rows, this turns them into an EffectiveAgent. It is also where the
// clamps run the second time I7 asks for — on write *and* again at run time — so an installation
// written before its version was narrowed cannot outlive it.
import { AppError, type EffectiveAgent, type ModelClass, type Audience, type Tier } from '../contracts';
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

export function composeEffectiveAgent(input: ComposeInput): EffectiveAgent {
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
    systemPrompt: installation.promptAddendum
      ? `${version.systemPrompt}\n\n${installation.promptAddendum}`
      : version.systemPrompt,
    ...(rulePack ? { rulePack } : {}),
  };
}
