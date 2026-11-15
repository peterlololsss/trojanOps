import type { ApiError, RunResult } from '@/lib/contracts';

export type PublicRunState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly code: ApiError['code'] | 'unavailable'; readonly message: string }
  | { readonly status: 'success'; readonly input: string; readonly result: RunResult };
