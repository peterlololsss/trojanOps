import { route } from '@/lib/api';
import { previewForOrg } from '@/lib/documents/preview';

export const GET = route<{ orgId: string }>(({ actor, params, req }) =>
  previewForOrg(actor, params.orgId, new URL(req.url).searchParams.get('installation')));
