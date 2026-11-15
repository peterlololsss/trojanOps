'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { AlertCircle, ChevronDown, User } from 'lucide-react';
import type { Persona, PersonaClub } from '@/lib/identity';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { Scope } from './navigation';
import { ScopeLinks } from './scope-links';
import { changeSession, SessionChangeError, type SessionChange } from './session-request';

interface MastheadProps {
  readonly scopes: Scope[];
  readonly signedIn: boolean;
  readonly currentUserId: string | null;
  readonly activeOrgId: string | null;
  readonly demoMode: boolean;
  readonly personas: readonly Persona[];
  readonly clubs: readonly Pick<PersonaClub, 'orgId' | 'orgName'>[];
}

export function Masthead({ scopes, signedIn, currentUserId, activeOrgId, demoMode, personas, clubs }: MastheadProps) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState('');
  const [error, setError] = useState<{ message: string; change: SessionChange } | null>(null);
  const currentName = personas.find((person) => person.userId === currentUserId)?.name;
  const accountLabel = currentName ?? (signedIn ? 'Account' : 'Choose persona');

  function change(change: SessionChange) {
    if (inFlight.current || pending) return;
    inFlight.current = true;
    setError(null);
    setStatus(change.kind === 'org' ? 'Switching club' : change.userId ? 'Switching persona' : 'Signing out');
    startTransition(async () => {
      try {
        await changeSession(change);
        startTransition(() => {
          router.replace(change.kind === 'org' ? `/org/${encodeURIComponent(change.orgId)}` : '/');
          router.refresh();
        });
        setStatus('Session updated.');
      } catch (failure) {
        if (!(failure instanceof SessionChangeError)) throw failure;
        setError({ message: failure.message, change });
        setStatus('');
      } finally {
        inFlight.current = false;
      }
    });
  }

  return <>
    <header className="flex h-12 shrink-0 items-stretch bg-primary text-primary-foreground [&_a:focus-visible]:outline-primary-foreground [&_button:focus-visible]:outline-primary-foreground">
      <Link href="/" className="flex shrink-0 items-center px-3 text-base font-bold tracking-tight sm:px-6">TrojanOps</Link>
      <ScopeLinks scopes={scopes} />
      <div className="ml-auto flex min-w-0 shrink-0 items-center px-3 sm:px-6">
        {demoMode || signedIn ? <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={pending} aria-busy={pending} aria-label={demoMode ? `Persona: ${accountLabel}` : accountLabel}
              className="flex h-9 items-center gap-2 rounded-md px-2 hover:bg-primary-hover disabled:cursor-wait">
              <User aria-hidden="true" className="size-4 shrink-0" />
              <span className="max-w-32 truncate">{demoMode && currentName ? `Persona: ${currentName}` : accountLabel}</span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {demoMode && <>
              <DropdownMenuLabel>Persona</DropdownMenuLabel>
              {personas.length === 0 ? <p className="px-2 py-2 text-muted-foreground">No personas available. Open the persona page to check the demo data.</p> :
                <DropdownMenuRadioGroup value={currentUserId ?? ''} onValueChange={(userId) => {
                  if (userId !== currentUserId) change({ kind: 'persona', userId });
                }}>
                  {personas.map((person) => <DropdownMenuRadioItem key={person.userId} value={person.userId}>{person.name}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>}
              <DropdownMenuItem asChild><Link href="/">View personas and positions</Link></DropdownMenuItem>
            </>}
            {clubs.length > 1 && <>
              {demoMode && <DropdownMenuSeparator />}
              <DropdownMenuLabel>Acting in</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeOrgId ?? ''} onValueChange={(orgId) => {
                if (orgId !== activeOrgId) change({ kind: 'org', orgId });
              }}>
                {clubs.map((club) => <DropdownMenuRadioItem key={club.orgId} value={club.orgId}>{club.orgName}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </>}
            {signedIn && <>
              {(demoMode || clubs.length > 1) && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => change({ kind: 'persona', userId: null })}>Sign out</DropdownMenuItem>
            </>}
          </DropdownMenuContent>
        </DropdownMenu> : <span className="flex items-center gap-2"><User aria-hidden="true" className="size-4" />Signed out</span>}
      </div>
    </header>
    <p aria-live="polite" className="sr-only">{status}</p>
    {error && <Alert variant="destructive" className="m-4 items-center">
      <AlertCircle aria-hidden="true" />
      <p className="min-w-0 flex-1">{error.message}</p>
      <Button variant="outline" onClick={() => change(error.change)}>Retry</Button>
    </Alert>}
  </>;
}
