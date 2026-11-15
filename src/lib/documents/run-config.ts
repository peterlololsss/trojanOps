import type { ModelClass } from '../contracts';
import type { QuotaLine } from '../gateway/quota-line';

export interface ChatConfig {
  readonly orgId: string;
  readonly scope: { readonly sentence: string; readonly grantLabels: string[]; readonly sources: string[]; readonly billedClub: string };
  readonly models: {
    readonly allowed: Array<{ readonly modelClass: ModelClass; readonly priceMicro: number }>;
    readonly defaultClass: ModelClass;
    readonly fixedByClub: boolean;
    readonly limitedByTemplate: boolean;
  };
  readonly quota: QuotaLine;
  readonly blockedMessage: string | null;
  readonly starters: string[];
  readonly audienceLabel: string;
  readonly templateVersion: number;
}
