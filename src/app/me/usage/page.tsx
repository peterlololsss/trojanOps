import Link from 'next/link';
import { PageHeader } from '@/components/shell';
import { getActor } from '@/lib/identity';
import { myUsage } from '@/lib/gateway/usage';
import { UsageView } from './usage-view';

export default async function UsagePage() {
  const actor = await getActor();
  if (!actor.userId) return <><PageHeader title="Usage" /><p><Link href="/" className="text-primary underline">Choose a persona to sign in.</Link></p></>;
  return <><PageHeader title="Usage" description="Your AI credits and runs. Only you can see this page." /><UsageView key={actor.userId} data={await myUsage(actor)} /></>;
}
