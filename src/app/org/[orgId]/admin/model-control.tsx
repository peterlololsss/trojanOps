'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import type { CatalogEntry } from '@/lib/distribution';
import { MODEL_LABELS, creditLabel } from '@/lib/gateway/prices';
import { usd } from '@/lib/gateway/quota-messages';
import { fieldClass } from '@/components/inspector/field';
import { writeErrorMessage } from './admin-view';

export function ModelControl({ agent, orgId }: { readonly agent: CatalogEntry; readonly orgId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const models = agent.memberModels;
  if (!models) return <p className="text-sm text-muted-foreground">Retired template · model choices unavailable</p>;
  return <div className="min-w-[240px] flex-1"><label className="block space-y-1"><span className="block text-sm font-semibold">Model for members</span><select value={models.fixed ?? ''} disabled={pending || agent.status === 'retired'} aria-label={`Model for members: ${agent.name}`} className={fieldClass} onChange={(e) => {
    const value = e.target.value;
    if (saving.current || (value !== '' && value !== 'economy' && value !== 'standard')) return;
    saving.current = true;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/orgs/${orgId}/installations/${agent.installationId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modelClass: value || null }) });
        setFailure(!response.ok);
        if (!response.ok) { setMessage(`${await writeErrorMessage(response, 'Could not change the model.')}${response.status === 422 ? ' Recorded in the audit log.' : ''}`); return; }
        setMessage(`${agent.name}: ${value ? `${MODEL_LABELS[value]} only` : 'members choose'}.`); router.refresh();
      } catch (error) {
        if (error instanceof Error) { setFailure(true); setMessage('Could not reach the server. Try again.'); } else throw error;
      } finally { saving.current = false; }
    });
  }}><option value="">Members choose (default {MODEL_LABELS[models.defaultClass]})</option><option value="economy">Economy only</option><option value="standard">Standard only</option></select></label>
  <p className="mt-2 text-sm text-muted-foreground" title="The template and USG club policy jointly cap these models.">Allowed by USG: {models.allowed.map((c) => MODEL_LABELS[c]).join(', ')}</p>
  <p className="mt-1 text-sm text-muted-foreground">Agent budget: {agent.limitMicro === null ? 'Club budget' : `${usd(agent.limitMicro)} · ${creditLabel(agent.limitMicro)}`}</p>
  <p role={failure ? 'alert' : 'status'} className={`mt-2 flex items-start gap-1 text-sm ${failure ? 'text-primary' : 'text-muted-foreground'}`}>{failure && message && <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />}{pending ? 'Saving model…' : message}</p></div>;
}
