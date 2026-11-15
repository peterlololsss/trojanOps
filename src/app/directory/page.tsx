// Owner: D (WP-11). Directory (§14 `/directory`): the org directory. A member acting in a club lands on
// its departments; USG and students outside a club land on the clubs.
import { redirect } from 'next/navigation';
import { directoryLanding } from '@/lib/directory/service';
import { getActor } from '@/lib/identity';
import { DirectorySignedOut } from './_dashboard/route-states';

export default async function DirectoryPage() {
  const actor = await getActor();
  if (!actor.userId) return <DirectorySignedOut />;
  redirect(await directoryLanding(actor));
}
