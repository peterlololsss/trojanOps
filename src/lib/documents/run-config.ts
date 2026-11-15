import type { ModelClass } from '../contracts';
import type { ModelId } from '../gateway/models';
import type { QuotaLine } from '../gateway/quota-line';

export interface ChatConfig {
  readonly orgId: string;
  readonly scope: { readonly sentence: string; readonly grantLabels: string[]; readonly sources: string[]; readonly billedClub: string };
  readonly models: {
    readonly allowed: Array<{ readonly modelClass: ModelClass; readonly priceMicro: number }>;
    readonly defaultClass: ModelClass;
    /** The models the member may pick, in registry order, and the one selected first. */
    readonly ids: ModelId[];
    readonly defaultId: ModelId;
    readonly fixedByClub: boolean;
    readonly limitedByTemplate: boolean;
  };
  readonly quota: QuotaLine;
  readonly blockedMessage: string | null;
  readonly starters: string[];
  readonly audienceLabel: string;
  readonly templateVersion: number;
}
