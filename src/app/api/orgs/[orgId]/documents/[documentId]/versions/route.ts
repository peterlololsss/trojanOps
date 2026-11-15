// Owner: C. POST /api/orgs/[orgId]/documents/[documentId]/versions: the library's manager publishes a
// new version of a document's text (JSON body { bodyMd, baseVersion }).
import { parseBody, route } from '@/lib/api';
import { publishDocumentVersion, publishDocumentVersionInput } from '@/lib/documents/library';

export const POST = route<{ orgId: string; documentId: string }>(async ({ actor, req, params }) =>
  publishDocumentVersion(actor, params.orgId, params.documentId, await parseBody(req, publishDocumentVersionInput)));
