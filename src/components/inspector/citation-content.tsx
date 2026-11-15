'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { Tier } from '@/lib/contracts';
import { tierLabels } from './access-labels';

function OpenDocument({ orgId, documentId }: { readonly orgId: string; readonly documentId: string }) {
  const router = useRouter();
  return <Button type="button" variant="ghost" onClick={() => router.push(`/org/${orgId}/documents/${documentId}`)}>Open in document</Button>;
}

export function CitationContent(p: {
  readonly n: number; readonly title: string; readonly quote: string; readonly tier: Tier;
  readonly allowed: boolean; readonly reason: string; readonly orgId?: string; readonly documentId: string;
  readonly onInspect?: () => void;
}) {
  return <><p className="text-xs text-muted-foreground">Source {p.n} · {tierLabels[p.tier]}</p><p className="mt-1 font-semibold">{p.title}</p>
    {p.allowed && <q className="mt-3 block text-[16px] leading-6">{p.quote}</q>}
    <p className="mt-3 text-sm">{p.reason}</p>
    {p.allowed && <div className="mt-3 flex flex-wrap gap-2">{p.orgId && <OpenDocument orgId={p.orgId} documentId={p.documentId} />}{p.onInspect && <Button type="button" variant="ghost" onClick={p.onInspect}>Show in inspector</Button>}</div>}
  </>;
}
