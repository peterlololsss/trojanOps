import { LockKeyhole } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppError } from '@/lib/contracts';
import { listManagedClubs, loadClubDetail } from '@/lib/connectors/club-detail';
import { listConnectors } from '@/lib/connectors/registry';
import { getActor } from '@/lib/identity';
import { requireRosterAdmin } from '@/lib/lifecycle/import';
import { ClubDetailPanel } from './club-detail';
import { IntegrationPanel } from './integration-panel';

export default async function IntegrationsPage({ searchParams }: {
  searchParams: Promise<{ club?: string | string[] }>;
}) {
  const actor = await getActor();
  try {
    await requireRosterAdmin(actor);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.error.code !== 'forbidden' && error.error.code !== 'unauthenticated') throw error;
    return <>
      <PageHeader title="Management" />
      <Alert>
        <LockKeyhole aria-hidden="true" />
        <div>
          <AlertTitle>USG administrator access required</AlertTitle>
          <AlertDescription>Sign in with a USG administrator account to review clubs and sync the roster. Contact a USG administrator if you need access.</AlertDescription>
        </div>
      </Alert>
    </>;
  }
  const { club } = await searchParams;
  if (club !== undefined) {
    const detail = typeof club === 'string' ? await loadClubDetail(actor, club) : null;
    if (!detail) notFound();
    return <ClubDetailPanel detail={detail} />;
  }
  const connectors = (await listConnectors()).map((connector) => ({
    ...connector, lastSyncAt: connector.lastSyncAt?.toISOString() ?? null,
  }));
  return <>
    <PageHeader title="Management" description="Review each club and manage club quotas and policy." />
    <IntegrationPanel key={`${actor.userId}:${actor.activeOrgId}`} connectors={connectors} clubs={await listManagedClubs(actor)} />
  </>;
}
