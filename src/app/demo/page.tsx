import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { clock } from '@/lib/clock';
import { ClockControl } from './clock-control';

export default async function DemoPage() {
  await connection();
  if (process.env.DEMO_MODE !== '1') notFound();
  return <>
    <PageHeader title="Demo controls" description="Prepare the demo clock and reset between rehearsals." />
    <div className="max-w-[640px] space-y-8">
      <ClockControl initialNow={clock.now().toISOString()} />
      <section aria-labelledby="reset-heading" className="space-y-3 border-t pt-6">
        <h2 id="reset-heading" className="text-xl font-semibold">Reset the demo</h2>
        <p>Stop the development server. In a terminal configured for the isolated demo database, run:</p>
        <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted p-4 font-mono text-sm">pnpm db:reset</pre>
        <p>This deletes and reseeds the configured database. Run it only against the demo database.
          After it succeeds, restart with <code className="font-mono">pnpm dev</code>.
          The clock starts at the configured DEMO_NOW.</p>
        <p>Changing the clock does not reset memberships, usage, publications or audit events.
          Reset before each complete D1–D8 rehearsal and before judging, not between beats.</p>
        <p>If a real agent fails during the presentation, stop the server, set AGENT_RUNTIME to
          mock and restart. Replies remain labeled as placeholder answers.</p>
      </section>
    </div>
  </>;
}
