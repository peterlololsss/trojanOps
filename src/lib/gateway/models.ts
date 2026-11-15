// Owner: A. The demo models a template can offer and a run can name. Each maps to one pricing class:
// club policy, installation overrides, quota holds and prices stay class-based (decision 29).
// Template versions store these ids (migration 0005), so renaming or removing one needs a migration.
import type { ModelClass } from '../contracts';

/** TODO(verify): official API IDs, checked 2026-11-15. Demo pricing maps to the gateway's existing classes.
 * https://developers.openai.com/api/docs/models
 * https://platform.claude.com/docs/en/models/overview
 * https://aistudio.google.com/docs/models
 */
export const DEMO_MODELS = [
  { id: 'gpt-6-luna', label: 'gpt-6-luna', provider: 'OpenAI', modelClass: 'economy' },
  { id: 'gpt-6.1-sol', label: 'gpt-6.1-sol', provider: 'OpenAI', modelClass: 'standard' },
  { id: 'claude-haiku-5-5', label: 'claude-haiku-5-5', provider: 'Anthropic', modelClass: 'economy' },
  { id: 'claude-sonnet-5-5', label: 'claude-sonnet-5-5', provider: 'Anthropic', modelClass: 'standard' },
  { id: 'gemini-4-hydrogen', label: 'gemini-4-hydrogen', provider: 'Google', modelClass: 'economy' },
  { id: 'gemini-4-carbon', label: 'gemini-4-carbon', provider: 'Google', modelClass: 'standard' },
] as const satisfies readonly { readonly id: string; readonly label: string; readonly provider: string; readonly modelClass: ModelClass }[];

export type DemoModel = (typeof DEMO_MODELS)[number];
export type ModelId = DemoModel['id'];
export const MODEL_IDS = DEMO_MODELS.map((m) => m.id) as [ModelId, ...ModelId[]];
export const MODEL_PROVIDERS = [...new Set(DEMO_MODELS.map((m) => m.provider))];

export const isModelId = (id: string): id is ModelId => DEMO_MODELS.some((m) => m.id === id);
export const modelById = (id: string): DemoModel | undefined => DEMO_MODELS.find((m) => m.id === id);
/** The pricing class of a known model id. */
export function classOf(id: ModelId): ModelClass {
  const model = modelById(id);
  if (!model) throw new Error(`Unknown demo model "${id}": a stored model id is missing from DEMO_MODELS.`);
  return model.modelClass;
}
/** Known ids in registry order, without duplicates. */
export const orderedModelIds = (ids: readonly string[]): ModelId[] => MODEL_IDS.filter((id) => ids.includes(id));
/** The classes a set of model ids spans, economy first. */
export const classesOf = (ids: readonly string[]): ModelClass[] =>
  (['economy', 'standard'] as const).filter((c) => DEMO_MODELS.some((m) => m.modelClass === c && ids.includes(m.id)));

/** A template version's model columns: the offered ids plus the pricing classes they span. */
export function modelFields(ids: readonly string[], defaultModelId: ModelId) {
  const modelIds = orderedModelIds(ids);
  return { modelIds, defaultModelId, modelClasses: classesOf(modelIds), defaultModelClass: classOf(defaultModelId) };
}
