import type { ModelClass } from '@/lib/contracts';

/** TODO(verify): official API IDs, checked 2026-11-15. Demo pricing maps to the gateway's existing classes.
 * https://developers.openai.com/api/docs/models
 * https://platform.claude.com/docs/en/models/overview
 * https://aistudio.google.com/docs/models
 */
export const DEMO_MODELS = [
  { id: 'gpt-6-luna', label: 'gpt-6-luna', modelClass: 'economy' },
  { id: 'gpt-6.1-sol', label: 'gpt-6.1-sol', modelClass: 'standard' },
  { id: 'claude-haiku-5-5', label: 'claude-haiku-5-5', modelClass: 'economy' },
  { id: 'claude-sonnet-5-5', label: 'claude-sonnet-5-5', modelClass: 'standard' },
  { id: 'gemini-4-hydrogen', label: 'gemini-4-hydrogen', modelClass: 'economy' },
  { id: 'gemini-4-carbon', label: 'gemini-4-carbon', modelClass: 'standard' },
] as const satisfies readonly { readonly id: string; readonly label: string; readonly modelClass: ModelClass }[];
