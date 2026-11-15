import { LockKeyhole } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppError } from '@/lib/contracts';
import { listConnectors } from '@/lib/connectors/registry';
import { getActor } from '@/lib/identity';
import { requireRosterAdmin } from '@/lib/lifecycle/import';
import { IntegrationPanel } from './integration-panel';

export default async function IntegrationsPage() {
  const actor = await getActor();
  try {
    await requireRosterAdmin(actor);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.error.code !== 'forbidden' && error.error.code !== 'unauthenticated') throw error;
    return <>
      <PageHeader title="Integrations" />
      <Alert>
        <LockKeyhole aria-hidden="true" />
        <div>
          <AlertTitle>USG administrator access required</AlertTitle>
          <AlertDescription>Sign in with a USG administrator account to review connectors and sync the roster. Contact a USG administrator if you need access.</AlertDescription>
        </div>
      </Alert>
    </>;
  }
  const connectors = await listConnectors();
  return <>
    <PageHeader title="Integrations" description="Review connector health and sync club memberships from the demo roster." />
    <IntegrationPanel key={`${actor.userId}:${actor.activeOrgId}`} connectors={connectors.map((connector) => ({
      ...connector, lastSyncAt: connector.lastSyncAt?.toISOString() ?? null,
    }))} />
  </>;
}
