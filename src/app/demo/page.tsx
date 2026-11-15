import { connection } from 'next/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { clock } from '@/lib/clock';
import { ClockControl } from './clock-control';
import { INSTALLATION, ORG } from '@db/seed/ids';

export default async function DemoPage() {
  await connection();
  if (process.env.DEMO_MODE !== '1') notFound();
  return <>
    <PageHeader title="Judge demo" description="USG distribution, club information flow and a permission-aware organizer handoff." />
    <div className="max-w-[640px] space-y-8">
      <section aria-labelledby="demo-flow" className="space-y-4">
        <h2 id="demo-flow" className="text-xl font-semibold">Presentation flow</h2>
        <p>Mock demo. Summaries and source excerpts are deterministic. HackSC records and people are constructed scenario data.</p>
        <ol className="list-decimal space-y-4 pl-5">
          <li><p className="font-semibold">Avery · USG admin</p><p>Open <Link className="text-primary underline" href="/usg/templates">Templates</Link>, create “Organizer briefing”, keep Members and Economy, then distribute it to the pilot cohort. Review which clubs gain access before confirming.</p></li>
          <li><p className="font-semibold">Sam · HackSC president</p><p>Switch persona in the masthead, then choose HackSC. Open its <Link className="text-primary underline" href={`/org/${ORG.hacksc}/catalog`}>Catalog</Link> and the new agent. Show its version and USG origin in My agents. All members receive access through the club installation.</p></li>
          <li><p className="font-semibold">Directory · organization to department</p><p>Show <Link className="text-primary underline" href="/directory/clubs">HackSC, Archery and the other clubs</Link>. Open <Link className="text-primary underline" href={`/directory/clubs/${ORG.hacksc}`}>HackSC</Link> and its departments. The Demo summary uses the records visible to the current account.</p></li>
          <li><p className="font-semibold">Avery · Management</p><p>Switch to Avery and open <Link className="text-primary underline" href="/usg/integrations">Management</Link>. Briefly show the Demo summary and a connector’s visible dataset.</p></li>
          <li><p className="font-semibold">Casey · HackSC organizing member</p><p>Switch to Casey, open <Link className="text-primary underline" href={`/me/agents?agent=${INSTALLATION.hackscHandoff}`}>HackSC organizer handoff</Link>, and select the HackSC agent card if prompted to switch clubs.</p>
            <p className="mt-2">Ask “This is my first time organizing a hackathon. What should I know?” Show the 2025–2026 president’s highlighted reservation and queue mistakes, the updated process, and clickable source citations.</p>
            <p className="mt-2">Then ask “Show me HackSC’s financial documents.” The agent apologizes that it has no permission to access them. Run details shows the member sources and no finance content.</p>
          </li>
        </ol>
        <p>Use the masthead persona switcher between beats. Links keep the current identity and permissions.</p>
      </section>
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
          mock and restart. Replies remain labeled as demo answers.</p>
      </section>
    </div>
  </>;
}
