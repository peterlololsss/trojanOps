'use client';

import { useState } from 'react';
import { Check, CircleMinus, Lock, ShieldAlert } from 'lucide-react';
import type { AccessCell, PreviewMatrix, Tier } from '@/lib/contracts';

const tiers: Record<Tier, string> = { public: 'Public', members: 'Members', officers: 'Officers', usg_internal: 'USG internal' };
const decisions = {
  allowed: { label: 'Allowed', icon: Check, style: 'text-success', explanation: 'The simulated grants match this document, and it is within the agent’s sources and max tier.' },
  not_granted: { label: 'Not granted', icon: Lock, style: 'text-muted-foreground', explanation: 'The simulated grants do not match this document’s required access.' },
  outside_sources: { label: 'Outside agent sources', icon: CircleMinus, style: 'text-muted-foreground', explanation: 'This document’s source is outside the agent’s configured sources.' },
  above_max_tier: { label: 'Above agent max tier', icon: ShieldAlert, style: 'text-attention-ink', explanation: 'This document’s tier is above the agent’s configured max tier.' },
} satisfies Record<AccessCell, { label: string; icon: typeof Check; style: string; explanation: string }>;

export function PermissionMatrix({ matrix, maxTier, agentName }: { matrix: PreviewMatrix; maxTier: Tier; agentName: string }) {
  const [selected, setSelected] = useState<{ subject: PreviewMatrix['subjects'][number]; document: PreviewMatrix['documents'][number]; decision: AccessCell } | null>(null);
  if (matrix.documents.length === 0) {
    return <p className="rounded-md border border-border p-4">No readable documents are available for this preview. Upload a document with access for your position, then return to preview it.</p>;
  }
  const grants = selected?.subject.key === 'student' ? 'Signed-in student grant'
    : selected?.subject.key === 'member' ? 'Signed-in student and club membership grants'
      : `Signed-in student, club membership and ${selected?.subject.label} position grants`;
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{agentName} · Max tier: {tiers[maxTier]}. Select a cell to inspect its access path.</p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Document access through {agentName}, by position</caption>
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="min-w-44 px-3 py-3 font-semibold">Position</th>
              {matrix.documents.map((doc) => (
                <th key={doc.id} scope="col" className="min-w-48 px-3 py-3 align-top font-semibold">
                  <span className="block">{doc.title}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">{doc.source} · {tiers[doc.tier]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.subjects.map((subject) => (
              <tr key={subject.key} className="border-t border-border">
                <th scope="row" className="px-3 py-2 font-semibold">{subject.label}</th>
                {matrix.documents.map((doc) => {
                  const decision = matrix.cells[subject.key][doc.id];
                  const status = decisions[decision];
                  const Icon = status.icon;
                  return (
                    <td key={doc.id} className="p-1">
                      <button
                        type="button"
                        aria-label={`${subject.label} · ${doc.title} · ${status.label}`}
                        aria-pressed={selected?.subject.key === subject.key && selected.document.id === doc.id}
                        onClick={() => setSelected({ subject, document: doc, decision })}
                        className={`flex min-h-10 w-full items-center gap-2 rounded-sm px-2 py-2 text-left hover:bg-accent aria-pressed:bg-accent ${status.style}`}
                      >
                        <Icon aria-hidden className="size-4 shrink-0" />{status.label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-label="Access explanation" aria-live="polite" className="rounded-md border border-border bg-muted p-4">
        <h2 className="mb-2 font-semibold">Access explanation</h2>
        {selected ? (
          <>
            <p className="mb-2">{selected.subject.label} → {grants} → {tiers[selected.document.tier]} · {selected.document.source}</p>
            <p><strong>{decisions[selected.decision].label}.</strong> {decisions[selected.decision].explanation}</p>
            <p className="mt-2 text-muted-foreground">Document: {selected.document.title} · Agent max tier: {tiers[maxTier]}</p>
          </>
        ) : <p className="text-muted-foreground">Select any Allowed or blocked cell to see its position, simulated grants, document tier and source.</p>}
      </section>
    </div>
  );
}
