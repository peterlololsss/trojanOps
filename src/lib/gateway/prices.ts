import type { ModelClass } from '../contracts';

export const CREDIT_MICRO = 10_000;
export const MODEL_LABELS: Readonly<Record<ModelClass, string>> = { economy: 'Economy', standard: 'Standard' };
const PRICES: Readonly<Record<ModelClass, number>> = { economy: CREDIT_MICRO, standard: 3 * CREDIT_MICRO };
export const priceMicro = (modelClass: ModelClass): number => PRICES[modelClass];
export const credits = (micro: number): number => micro / CREDIT_MICRO;
export const creditLabel = (micro: number): string => `${credits(micro).toLocaleString('en-US', { maximumFractionDigits: 2 })} credit${micro === CREDIT_MICRO ? '' : 's'}`;
