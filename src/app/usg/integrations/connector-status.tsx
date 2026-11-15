// Owner: D. Connector labels, health and sync-time format for the Management overview.
import { Check, CircleAlert, CircleX } from 'lucide-react';
import type { ConnectorKind, ConnectorStatus } from '@/lib/contracts';

export type ConnectorRow = Omit<ConnectorStatus, 'lastSyncAt'> & { readonly lastSyncAt: string | null };

export const connectorLabels: Record<ConnectorKind, string> = {
  identity: 'Identity', roster: 'Roster', documents: 'Documents', llm: 'Language model', applications: 'Applications',
};

export const health = {
  ok: { label: 'OK', Icon: Check, variant: 'success' },
  degraded: { label: 'Degraded', Icon: CircleAlert, variant: 'attention' },
  down: { label: 'Down', Icon: CircleX, variant: 'danger' },
} as const;

export const syncTimeFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'long', timeZone: 'America/Los_Angeles',
});
