// Owner: C. Shared words and icons for document tiers and access decisions, so the run inspector
// and the permission preview (/org/[orgId]/preview) describe access the same way.
import { Check, CircleMinus, Globe, Landmark, Lock, ShieldAlert, UserCheck, Users, type LucideIcon } from 'lucide-react';
import type { AccessCell, Tier } from '@/lib/contracts';

export const tierLabels: Record<Tier, string> = {
  public: 'Public',
  members: 'Members',
  officers: 'Officers',
  usg_internal: 'USG internal',
};

export const tierIcons: Record<Tier, LucideIcon> = {
  public: Globe,
  members: Users,
  officers: UserCheck,
  usg_internal: Landmark,
};

/** Chip tone for an access decision (see chip.tsx). `style` is the plain text color for table cells. */
export type AccessTone = 'success' | 'neutral' | 'attention';

export const accessDecisions = {
  allowed: { label: 'Allowed', icon: Check, style: 'text-success', tone: 'success', explanation: 'The simulated grants match this document, and it is within the agent’s sources and max tier.' },
  not_granted: { label: 'Not granted', icon: Lock, style: 'text-muted-foreground', tone: 'neutral', explanation: 'The simulated grants do not match this document’s required access.' },
  outside_sources: { label: 'Outside agent sources', icon: CircleMinus, style: 'text-muted-foreground', tone: 'neutral', explanation: 'This document’s source is outside the agent’s configured sources.' },
  above_max_tier: { label: 'Above agent max tier', icon: ShieldAlert, style: 'text-attention-ink', tone: 'attention', explanation: 'This document’s tier is above the agent’s configured max tier.' },
} satisfies Record<AccessCell, { label: string; icon: LucideIcon; style: string; tone: AccessTone; explanation: string }>;
