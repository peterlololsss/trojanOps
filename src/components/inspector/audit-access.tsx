// Owner: C (WP-9). The audit views' signed-out and no-permission states (ui-designer.md "States": who
// has access and how to ask). Server-safe, so the pages render them without client code.
import Link from 'next/link';
import { Lock } from 'lucide-react';

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-border bg-muted p-4">
      <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function AuditSignedOut() {
  return (
    <Notice>
      Sign in to read the audit log. <Link href="/" className="text-primary underline">Choose a persona to sign in</Link>.
    </Notice>
  );
}

export function AuditForbidden({ scope }: { scope: 'club' | 'usg' }) {
  return scope === 'club' ? (
    <Notice>
      Only this club’s president, with this club active, and USG admins can read this audit log.{' '}
      <Link href="/" className="text-primary underline">Switch your persona or active club</Link>, or ask your club president.
    </Notice>
  ) : (
    <Notice>
      Only USG admins can read the full audit log. Club presidents can read their own club’s log from the club’s Audit
      page. <Link href="/" className="text-primary underline">Switch your persona or active club</Link>, or ask a USG admin.
    </Notice>
  );
}
