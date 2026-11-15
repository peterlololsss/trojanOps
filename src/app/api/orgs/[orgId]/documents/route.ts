// Owner: C (WP-8). GET /api/orgs/[orgId]/documents: the club's library for the actor.
// POST /api/orgs/[orgId]/documents: a president uploads a document (JSON body, uploadDocumentInput).
import { parseBody, requireUser, route } from '@/lib/api';
import { listLibraryDocuments, uploadDocument, uploadDocumentInput } from '@/lib/documents/library';

export const GET = route<{ orgId: string }>(async ({ actor, params }) => {
  requireUser(actor);
  return listLibraryDocuments(actor, params.orgId);
});

export const POST = route<{ orgId: string }>(async ({ actor, req, params }) =>
  uploadDocument(actor, params.orgId, await parseBody(req, uploadDocumentInput)));
