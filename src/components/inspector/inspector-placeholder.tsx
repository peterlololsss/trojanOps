// Owner: C (WP-9). The inspector column before the first run: the same six sections as <Inspector />,
// each saying what it will show, so the layout does not jump when the first run returns.
import { Section } from './inspector';

const SECTIONS: Array<[title: string, note: string]> = [
  ['Run grants', 'The club positions this run acts with.'],
  ['Sources', 'The document sources this agent may read.'],
  ['Documents', 'Permitted documents and the ones the answer cites.'],
  ['Versions', 'The template and rule pack versions in use.'],
  ['Billing', 'The billed club, the cost of the run and the quota left.'],
  ['Audit', 'The audit event that records the run.'],
];

export function InspectorPlaceholder() {
  return (
    <aside aria-label="Run inspector" className="w-[384px] max-w-full shrink-0 border-l border-border bg-background text-[14px] leading-5">
      <p className="border-b border-border bg-muted px-[16px] py-[12px]">Run the agent to see its grants, documents and billing.</p>
      {SECTIONS.map(([title, note]) => (
        <Section key={title} title={title}>
          <p className="text-muted-foreground">{note}</p>
        </Section>
      ))}
    </aside>
  );
}
