import { z } from 'zod';
import { parseBody, route } from '@/lib/api';
import { importRoster } from '@/lib/lifecycle/import';

export const POST = route(async ({ actor, req }) => {
  await parseBody(req, z.strictObject({}));
  return importRoster(actor);
});
