// Owner: B (WP-7). Club admin (§14 `/org/[orgId]/admin`): members, positions, transfer, quotas,
// installations and club agents. It carries D5 (a president sets a member's budget) and D7 (a
// president transfers an office).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { clubAdmin, transferCandidates } from '@/lib/distribution';
import { getActor } from '@/lib/identity';
import { ClubAgents, ClubBudget, SectionTitle } from './admin-sections';
import { MembersTable } from './members-table';
import { PositionsTable } from './positions-table';

export default async function ClubAdminPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const actor = await getActor();
  if (!actor.userId) {
    return (
      <>
        <PageHeader title="Manage club" description="Sign in as a club president to manage a club." />
        <p className="flex items-center gap-2 rounded-md border border-border p-4">
          <Lock aria-hidden className="size-4" />
          <Link href="/" className="text-primary underline">Choose a persona to sign in</Link>
        </p>
      </>
    );
  }

  // The service is president-only: it carries every member's name and budget, so a refusal says
  // who may open it rather than becoming Next's error page. Null is a club that does not exist.
  // Any other failure is a banner, the way the club home handles its own load.
  let data;
  try {
    data = await clubAdmin(actor, orgId);
  } catch (error) {
    if (!(error instanceof AppError) || error.error.code !== 'forbidden') {
      return (
        <>
          <PageHeader title="Manage club" description="Members, positions, budgets and agents." />
          <p role="alert" className="rounded-md border border-primary p-4">
            This club could not be loaded. Reload the page, or try again in a moment.
          </p>
        </>
      );
    }
    return (
      <>
        <PageHeader title="Manage club" description="A club is managed by its own president." />
        <p className="flex items-start gap-2 rounded-md border border-border p-4">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Only a president of this club, with the club active, can see its roster and budgets. Ask
            your president to change a member&rsquo;s limit or to hand over a position. If you are a
            president,{' '}
            <Link href="/" className="text-primary underline">switch your persona or active club</Link>.
            USG manages club quotas and policy from its own console.
          </span>
        </p>
      </>
    );
  }
  if (!data) notFound();

  // Who could take each position is worked out here, on the server: the client table must not
  // import a distribution service, which would carry the database into the browser bundle.
  const roster = data.positions.map((position) => ({
    position,
    candidates: transferCandidates(data, position.slug),
  }));

  return (
    <>
      <PageHeader
        title={`Manage ${data.org.name}`}
        description="Positions, members, monthly budgets and the agents installed in this club."
        action={(
          <Link href={`/org/${data.org.id}`} className="text-primary underline">Club home</Link>
        )}
      />
      <div className="space-y-8">
        <ClubBudget data={data} />

        <section aria-labelledby="positions" className="space-y-3">
          <div>
            <SectionTitle id="positions">Positions</SectionTitle>
            <p className="text-muted-foreground">
              An office carries the agents its position opens. Transferring it moves them at the same
              instant; a later roster sync does not undo it.
            </p>
          </div>
          <PositionsTable key={`${data.org.id}:positions`} data={data} rows={roster} />
        </section>

        <section aria-labelledby="members" className="space-y-3">
          <div>
            <SectionTitle id="members">Members and budgets</SectionTitle>
            <p className="text-muted-foreground">
              What each member may spend on agent runs this month. A member with no limit of their own
              may spend the club&rsquo;s whole quota.
            </p>
          </div>
          <MembersTable key={`${data.org.id}:members`} data={data} />
        </section>

        <ClubAgents data={data} />
      </div>
    </>
  );
}
