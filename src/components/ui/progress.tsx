import { cn } from '@/lib/utils';

type ProgressProps = Omit<React.ComponentProps<'div'>, 'children'> & { value?: number; max?: number };

export function Progress({ className, value, max = 100, ...props }: ProgressProps) {
  const limit = Number.isFinite(max) && max > 0 ? max : 100;
  const current = value === undefined || !Number.isFinite(value) ? undefined : Math.min(limit, Math.max(0, value));
  return (
    <div {...props} data-slot="progress" role="progressbar" aria-valuemin={0} aria-valuemax={limit}
      aria-valuenow={current} className={cn('h-2 w-full overflow-hidden rounded-sm bg-border', className)}>
      <div className={cn('h-full bg-primary', current === undefined && 'motion-safe:animate-pulse')}
        style={{ width: current === undefined ? '100%' : String(current / limit * 100) + '%' }} />
    </div>
  );
}
