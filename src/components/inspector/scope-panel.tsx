import type { ChatConfig } from '@/lib/documents/run-config';
import { Section } from './inspector';

export function ScopePanel({ config }: { readonly config: ChatConfig }) {
  return <aside aria-label="Run inspector" className="w-full border-l border-border bg-background text-sm">
    <p className="bg-muted px-4 py-3 font-semibold">Before your first run</p>
    <Section title="Run grants"><ul className="space-y-1">{config.scope.grantLabels.map((g) => <li key={g}>{g}</li>)}</ul></Section>
    <Section title="Sources"><ul className="space-y-1">{config.scope.sources.map((s) => <li key={s}>{s}</li>)}</ul></Section>
    <Section title="Documents"><p className="text-muted-foreground">Titles appear only after the gateway checks which documents this run can read.</p></Section>
    <Section title="Versions"><p>Template v{config.templateVersion}</p></Section>
    <Section title="Billing"><p>Paid by {config.scope.billedClub}.</p></Section>
    <Section title="History"><p>Earlier messages: not sent (demo runtime).</p></Section>
    <Section title="Audit"><p className="text-muted-foreground">No run yet.</p></Section>
  </aside>;
}
