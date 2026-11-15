import { cn } from '@/lib/utils';

export function Separator({ className, ...props }: React.ComponentProps<'hr'>) {
  return <hr data-slot="separator" className={cn('border-0 border-t border-border', className)} {...props} />;
}
