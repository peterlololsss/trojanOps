// Owner: C (WP-9). A pending write action (I6) inline in the transcript: nothing runs until the user
// who ran the agent confirms it. A reject is recorded by the gateway and is final too.
// Presentational; <RunWorkspace /> owns the requests.
// Status is icon + word, never color alone. One always-mounted live region per card carries the
// progress and outcome, so screen readers announce each change.
import { AlertCircle, Check, CircleSlash, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from './chip';
import { humanizeTool } from './format';
import { canConfirm, canReject, type ActionStatus } from './run-state';

export interface PendingActionCardProps {
  action: { id: string; tool: string };
  status: ActionStatus;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
}

function LiveStatus({ status }: { status: ActionStatus }) {
  const content = status.status === 'confirming' ? { icon: Clock, text: 'Confirming…', style: '' }
    : status.status === 'rejecting' ? { icon: Clock, text: 'Rejecting…', style: '' }
    : status.status === 'confirmed' ? { icon: Check, text: 'Confirmed and recorded in the audit log.', style: 'text-success' }
      : status.status === 'rejected' ? { icon: CircleSlash, text: 'Rejected. Nothing ran.', style: 'text-muted-foreground' }
        : null;
  const Icon = content?.icon;
  return (
    <p role="status" aria-live="polite" className={`flex items-center gap-[8px] ${content ? `mt-[8px] ${content.style}` : ''}`}>
      {content && Icon && (
        <>
          <Icon aria-hidden className="size-[16px] shrink-0" />
          <span className="font-semibold">{content.text}</span>
        </>
      )}
    </p>
  );
}

export function PendingActionCard({ action, status, onConfirm, onReject }: PendingActionCardProps) {
  const confirmable = canConfirm(status);
  const finalRefusal = status.status === 'failed' && !status.retry;
  const waiting = confirmable || status.status === 'confirming';
  const rejectable = canReject(status);
  const name = humanizeTool(action.tool);

  return (
    <section aria-label={`Pending action: ${name}`} className="mt-[12px] rounded-md border border-input bg-background px-[16px] py-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold leading-5">{name}</h3>
          <p className="font-mono text-[12px] leading-4 text-muted-foreground">{action.tool}</p>
        </div>
        {waiting && <Chip icon={Clock} tone="attention">Waiting for you</Chip>}
      </div>

      {waiting && <p className="mt-[8px]">Waits for you to confirm. Nothing runs until you do.</p>}

      {status.status === 'failed' && (
        <div role="alert" className="mt-[8px] flex items-start gap-[8px]">
          <AlertCircle aria-hidden className="mt-[2px] size-[16px] shrink-0 text-primary" />
          <div>
            <p>{status.retry ? `${status.message} You can try again.` : status.message}</p>
            {finalRefusal && (
              <p className="text-muted-foreground">Only the person who ran the agent, as a member of the agent’s club, can confirm or reject it.</p>
            )}
          </div>
        </div>
      )}

      <LiveStatus status={status} />

      {(confirmable || rejectable) && (
        <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
          {confirmable && (
            <Button type="button" className="h-[32px] px-[12px]" onClick={() => onConfirm?.(action.id)}>Confirm</Button>
          )}
          {rejectable && (
            <Button type="button" variant="outline" className="h-[32px] px-[12px]" onClick={() => onReject?.(action.id)}>Reject</Button>
          )}
        </div>
      )}
    </section>
  );
}
