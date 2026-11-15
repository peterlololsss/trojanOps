import { z } from 'zod';
import { parseBody, route } from '@/lib/api';
import { clock } from '@/lib/clock';

export const runtime = 'nodejs';

const setClock = route(async ({ req }) => {
  const body = await parseBody(req, z.strictObject({ now: z.iso.datetime({ offset: true }) }));
  clock.setDemoNow(new Date(body.now));
  return { now: clock.now().toISOString() };
});

export async function POST(req: Request, context: { params: Promise<Record<string, string>> }) {
  if (process.env.DEMO_MODE !== '1') {
    return Response.json({ code: 'not_found', message: 'Demo controls are unavailable.' }, { status: 404 });
  }
  return setClock(req, context);
}
