// Owner: B (WP-7). The club home's sections. Each one that loads its own data is a server component
// behind its own Suspense boundary in page.tsx, so a slow document read never holds up the agents,
// and each catches its own failure as a banner rather than taking the page down. There is no
// loading.tsx or error.tsx here: this folder is the parent of stream C's club pages, and a file
// there would wrap theirs too.
import Link from 'next/link';
import { AlertCircle, ArrowUpCircle, FileText, Lock } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { Actor } from '@/lib/contracts';
import { formatPacific, tierLabels } from '@/lib/documents/library-view';
import { getMyUsage, getRecentDocuments, RECENT_DOCUMENT_COUNT, type ClubHome } from './club-home-data';
import { agentCount, documentCount, usageSummary } from './club-home-view';

const panel = 'rounded-md border border-border';
const row = 'flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-border px-3 py-2 last:border-b-0';
const chip = 'inline-flex max-w-[200px] items-center gap-1 whitespace-nowrap rounded-sm border border-border px-2 text-xs';

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-[20px] font-semibold leading-7">{children}</h2>;
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-primary p-4">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className={`${panel} bg-muted p-4`}>{children}</div>;
}

// ---------------------------------------------------------------------------------------------
// My agents in this club

export function MyAgents({ home }: { home: ClubHome }) {
  const { org, mine, agentCount: installed } = home;
  const catalogLink = (
    <Link href={`/org/${org.id}/catalog`} className="text-primary underline">
      Catalog ({agentCount(installed)})
    </Link>
  );
  return (
    <section aria-labelledby="my-agents" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionTitle id="my-agents">My agents in this club</SectionTitle>
          <p className="text-muted-foreground">
            {mine === null
              ? `You are not a member of ${org.name}.`
              : mine.positionNames.length > 0
                ? `${org.name} · ${mine.positionNames.join(', ')}`
                : `${org.name} · no position`}
          </p>
        </div>
        {catalogLink}
      </div>

      {mine === null ? (
        <Note>
          <p className="flex items-start gap-2">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Members of {org.name} see the agents their club gives them here. Ask a {org.name} officer
              to add you to the roster. Agents open to all students are in the{' '}
              <Link href="/directory" className="text-primary underline">campus directory</Link>.
            </span>
          </p>
        </Note>
      ) : mine.agents.length === 0 ? (
        <Note>
          <p>
            {org.name} has not given your positions an agent yet. The catalog lists every agent
            installed here, including the ones that are turned off; a president can widen an agent&rsquo;s
            audience from there.
          </p>
        </Note>
      ) : (
        <ul className={panel}>
          {mine.agents.map((agent) => (
            <li key={agent.installationId} className={row}>
              <div className="min-w-[240px] flex-1">
                <p className="font-semibold">{agent.name}</p>
                <p className="text-muted-foreground">{agent.purpose}</p>
              </div>
              <p className="w-[200px]">
                <span className="text-muted-foreground">Open to </span>{agent.reasonLabel}
              </p>
              <p className="w-[72px] font-mono text-xs">v{agent.templateVersion}</p>
              <Link
                href={`/org/${org.id}/agents/${agent.installationId}`}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Recent documents

export function DocumentsSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading recent documents" className="space-y-3">
      <SectionTitle id="recent-documents-loading">Recent documents</SectionTitle>
      <div className={panel} aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex h-10 items-center gap-6 border-b border-border px-3 last:border-b-0">
            <div className="h-3 w-1/3 animate-pulse bg-muted" />
            <div className="h-3 w-1/5 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}

export async function RecentDocuments({ actor, home }: { actor: Actor; home: ClubHome }) {
  const { org } = home;
  let loaded: Awaited<ReturnType<typeof getRecentDocuments>>;
  try {
    loaded = await getRecentDocuments(actor, org.id);
  } catch {
    return (
      <section aria-labelledby="recent-documents" className="space-y-3">
        <SectionTitle id="recent-documents">Recent documents</SectionTitle>
        <Banner>
          Could not load {org.name}&rsquo;s documents. Reload this page, or open the{' '}
          <Link href={`/org/${org.id}/documents`} className="text-primary underline">document library</Link>.
        </Banner>
      </section>
    );
  }

  return (
    <section aria-labelledby="recent-documents" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionTitle id="recent-documents">Recent documents</SectionTitle>
          <p className="text-muted-foreground">
            {loaded.total > RECENT_DOCUMENT_COUNT
              ? `The newest ${RECENT_DOCUMENT_COUNT} of ${documentCount(loaded.total)} you can read in ${org.name}.`
              : `${documentCount(loaded.total)} you can read in ${org.name}.`}
          </p>
        </div>
        <Link href={`/org/${org.id}/documents`} className="text-primary underline">All documents</Link>
      </div>

      {loaded.documents.length === 0 ? (
        <Note>
          <p>
            No documents are available to you in {org.name} yet.{' '}
            {home.canManage
              ? 'Upload the first one from the document library.'
              : 'Ask the club president to upload a document your position can read.'}
          </p>
        </Note>
      ) : (
        <ul className={panel}>
          {loaded.documents.map((document) => (
            <li key={document.id} className={row}>
              <p className="min-w-[240px] flex-1 font-semibold">{document.title}</p>
              <p className="w-[160px] text-muted-foreground">{document.sourceName}</p>
              <span className={chip}>
                {document.tier === 'public'
                  ? <FileText aria-hidden className="size-3" />
                  : <Lock aria-hidden className="size-3" />}
                {tierLabels[document.tier]}
              </span>
              <time dateTime={document.createdAt.toISOString()} className="w-[200px] font-mono text-xs">
                {formatPacific(document.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// My usage this month

export function UsageSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading my usage" className="space-y-3">
      <SectionTitle id="my-usage-loading">My usage this month</SectionTitle>
      <div className={`${panel} space-y-3 p-4`} aria-hidden="true">
        <div className="h-3 w-48 animate-pulse bg-muted" />
        <div className="h-2 w-full bg-border" />
      </div>
    </section>
  );
}

export async function MyUsage({ actor, home }: { actor: Actor; home: ClubHome }) {
  const { org, mine } = home;
  if (mine === null) return null; // a non-member spends nothing here: the meter would read as theirs

  let usage: Awaited<ReturnType<typeof getMyUsage>>;
  try {
    usage = await getMyUsage(actor, org.id);
  } catch {
    return (
      <section aria-labelledby="my-usage" className="space-y-3">
        <SectionTitle id="my-usage">My usage this month</SectionTitle>
        <Banner>Could not load your quota in {org.name}. Reload this page to try again.</Banner>
      </section>
    );
  }

  const summary = usageSummary(usage, org.name);
  return (
    <section aria-labelledby="my-usage" className="space-y-3">
      <div>
        <SectionTitle id="my-usage">My usage this month</SectionTitle>
        <p className="text-muted-foreground">Agent runs you start in {org.name} are billed to the club.</p>
      </div>
      <div className={`${panel} max-w-[640px] space-y-3 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="tabular-nums">
            <span className="font-semibold">{summary.spent}</span>
            <span className="text-muted-foreground"> of {summary.limit} used · {summary.left} left</span>
          </p>
          {summary.attention && (
            <span className={`${chip} border-transparent bg-gold-25`}>
              <ArrowUpCircle aria-hidden className="size-3 text-attention-ink" />
              {summary.attention}
            </span>
          )}
        </div>
        <div
          role="meter"
          aria-labelledby="my-usage"
          aria-valuenow={summary.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${summary.spent} of ${summary.limit} used`}
          className="h-2 w-full overflow-hidden rounded-sm bg-border"
        >
          <div className="h-2 bg-primary" style={{ width: `${summary.percent}%` }} />
        </div>
        {summary.blocked && (
          <Banner>
            {summary.blocked} Until then, you can still read {org.name}&rsquo;s documents.
          </Banner>
        )}
      </div>
    </section>
  );
}
