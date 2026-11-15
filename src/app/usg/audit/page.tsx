import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuditTable } from '@/components/inspector';
import { AuditForbidden, AuditSignedOut } from '@/components/inspector/audit-access';
import { PageHeader } from '@/components/shell/page-header';
import { AppError } from '@/lib/contracts';
import { getAuditPageData, type AuditPageData } from '@/lib/documents/audit-view';
import { getActor } from '@/lib/identity';
import { ClubFilter } from './club-filter';

const SCOPE_NOTE = 'Agent runs, document access and admin changes. Messages and answers stay private to the person who ran them.';

export default async function UsgAuditPage({ searchParams }: { searchParams: Promise<{ club?: string | string[] }> }) {
  const query = await searchParams;
  const club = (Array.isArray(query.club) ? query.club[0] : query.club) || undefined;
  const actor = await getActor();
  if (!actor.userId) {
    return <><PageHeader title="Audit log" /><AuditSignedOut /></>;
  }
  let data: AuditPageData | null;
  try {
    data = await getAuditPageData(actor, club ? { kind: 'usg', orgId: club } : { kind: 'usg' });
  } catch (error) {
    if (!(error instanceof AppError) || error.error.code !== 'forbidden') throw error;
    return <><PageHeader title="Audit log" /><AuditForbidden scope="usg" /></>;
  }
  // An unknown or malformed club in the link: show every club rather than a 404.
  if (!data) redirect('/usg/audit');
  const scopeName = data.org?.name ?? 'USG';
  return (
    <>
      <PageHeader title="Audit log" description={`${data.org?.name ?? 'All clubs'} · ${SCOPE_NOTE}`} />
      <AuditTable
        key={`${actor.userId}:${actor.activeOrgId}:${data.org?.id ?? 'all'}`}
        rows={data.rows}
        scopeName={scopeName}
        today={data.today}
        truncated={data.truncated}
        caption={data.org ? `Audit events in ${data.org.name}, newest first` : 'Audit events across all clubs, newest first'}
        scopeFilter={<ClubFilter clubs={data.clubs} selected={data.org?.id ?? null} />}
        nothingYet={data.org ? <>
          <p className="font-semibold">No audit events in {data.org.name} yet.</p>
          <p className="mt-1 text-muted-foreground">Runs, uploads and changes in this club appear here as they happen.</p>
          <Link href="/usg/audit" className="mt-3 inline-block text-primary underline">Show every club</Link>
        </> : <>
          <p className="font-semibold">No audit events yet.</p>
          <p className="mt-1 text-muted-foreground">
            Agent runs, document access, template distribution, quota changes and roster syncs appear here as they happen.
          </p>
          <Link href="/usg/templates" className="mt-3 inline-block text-primary underline">Open USG templates</Link>
        </>}
      />
    </>
  );
}
