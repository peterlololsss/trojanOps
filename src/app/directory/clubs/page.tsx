// Owner: D (WP-11). Clubs (§14 `/directory/clubs`): every registered club, for USG and for students.
import { PageHeader } from '@/components/shell';
import { clubsDirectory } from '@/lib/directory/service';
import { getActor } from '@/lib/identity';
import { DirectorySignedOut } from '../_dashboard/route-states';
import { ClubsList } from './clubs-list';
import { ClubsSummary } from '../_dashboard/demo-summary';

export default async function ClubsPage() {
  const actor = await getActor();
  if (!actor.userId) return <DirectorySignedOut title="Clubs" />;
  const view = await clubsDirectory(actor);
  return <>
    <PageHeader title="Clubs" />
    <div className="mb-6"><ClubsSummary data={view} /></div>
    <ClubsList key={`${actor.userId}:${actor.activeOrgId}`} view={view} />
  </>;
}
