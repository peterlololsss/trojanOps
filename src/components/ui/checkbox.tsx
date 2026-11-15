import { cn } from '@/lib/utils';

// Native keyboard and form behavior. This is not Radix's checked/onCheckedChange API.
export function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return <input {...props} type="checkbox" data-slot="checkbox" className={cn(
    'size-4 shrink-0 rounded-sm border border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50',
    className,
  )} />;
}
