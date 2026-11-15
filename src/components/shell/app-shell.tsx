import { getActor, listPersonas } from '@/lib/identity';
import { personasEnabled } from '@/lib/identity/session';
import { myAgents } from '@/lib/distribution';
import { Footer } from './footer';
import { Masthead } from './masthead';
import { navigationFor } from './navigation';
import { ScopeSideNav } from './scope-side-nav';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const clubs = actor.userId ? await myAgents(actor.userId) : [];
  const demoMode = personasEnabled();
  const personas = demoMode ? await listPersonas() : [];
  const current = personas.find((person) => person.userId === actor.userId);
  const sessionClubs = current?.clubs ?? clubs;
  const scopes = navigationFor(actor, sessionClubs);
  return (
    <>
      <a href="#main-content" className="sr-only z-10 rounded-md bg-background px-4 py-2 text-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-2">
        Skip to content
      </a>
      <Masthead key={`${actor.userId}:${actor.activeOrgId}`} scopes={scopes} signedIn={Boolean(actor.userId)}
        currentUserId={actor.userId} activeOrgId={actor.activeOrgId} demoMode={demoMode}
        personas={personas} clubs={sessionClubs} />
      <div className="flex flex-1 flex-col md:flex-row">
        <ScopeSideNav scopes={scopes} />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 p-6">{children}</main>
      </div>
      <Footer />
    </>
  );
}
