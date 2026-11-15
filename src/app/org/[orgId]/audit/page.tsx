import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuditTable } from '@/components/inspector';
import { AuditForbidden, AuditSignedOut } from '@/components/inspector/audit-access';
import { PageHeader } from '@/components/shell/page-header';
import { AppError } from '@/lib/contracts';
import { getAuditPageData, type AuditPageData } from '@/lib/documents/audit-view';
import { getActor } from '@/lib/identity';

const SCOPE_NOTE = 'Agent runs, document access and admin changes. Messages and answers stay private to the person who ran them.';

export default async function ClubAuditPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const actor = await getActor();
  if (!actor.userId) {
    return <><PageHeader title="Audit log" /><AuditSignedOut /></>;
  }
  let data: AuditPageData | null;
  try {
    data = await getAuditPageData(actor, { kind: 'club', orgId });
  } catch (error) {
    if (!(error instanceof AppError) || error.error.code !== 'forbidden') throw error;
    return <><PageHeader title="Audit log" /><AuditForbidden scope="club" /></>;
  }
  if (!data?.org) notFound();
  const club = data.org;
  return (
    <>
      <PageHeader title="Audit log" description={`${club.name} · ${SCOPE_NOTE}`} />
      <AuditTable
        key={`${actor.userId}:${actor.activeOrgId}:${club.id}`}
        rows={data.rows}
        scopeName={club.name}
        today={data.today}
        truncated={data.truncated}
        caption={`Audit events in ${club.name}, newest first`}
        nothingYet={<>
          <p className="font-semibold">No audit events in {club.name} yet.</p>
          <p className="mt-1 text-muted-foreground">
            Agent runs, the documents each run could read, uploads and catalog changes appear here as they happen.
          </p>
          <Link href={`/org/${club.id}/catalog`} className="mt-3 inline-block text-primary underline">Open the club catalog</Link>
        </>}
      />
    </>
  );
}
