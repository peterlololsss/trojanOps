// Owner: C. Local status chip (ui-designer.md "Badge / status chip"): 2px radius, icon + word,
// tokens only. A stop-gap until stream D ships `ui/badge` (requested in the WP-9 PR).
// TODO(verify): @/components/ui/badge now exists; switch to it.
import type { LucideIcon } from 'lucide-react';

export type ChipTone = 'neutral' | 'success' | 'attention';

const tones: Record<ChipTone, { box: string; icon: string }> = {
  neutral: { box: 'border-border bg-muted text-foreground', icon: 'text-muted-foreground' },
  success: { box: 'border-border bg-background text-success', icon: 'text-success' },
  attention: { box: 'border-gold-25 bg-gold-25 text-foreground', icon: 'text-attention-ink' },
};

export function Chip({ icon: Icon, tone = 'neutral', children }: { icon: LucideIcon; tone?: ChipTone; children: string }) {
  const t = tones[tone];
  return (
    <span className={`inline-flex h-[20px] max-w-[200px] shrink-0 items-center gap-[4px] rounded-sm border px-[8px] text-[12px] font-semibold leading-4 ${t.box}`}>
      <Icon aria-hidden className={`size-[12px] shrink-0 ${t.icon}`} />
      <span className="truncate">{children}</span>
    </span>
  );
}
