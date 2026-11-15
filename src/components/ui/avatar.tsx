// Owner: D. Initials avatar for a person: the one round element in the UI (ui-designer.md "Radius").
// Agents and clubs never get one. Beside a visible name it is decorative; give `label` when it
// stands alone, as in a row of officers, so the name is announced and shown on hover.
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const avatarVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center rounded-full border font-semibold leading-none',
  {
    variants: {
      size: { sm: 'size-7 text-xs', md: 'size-10 text-sm' },
      tone: {
        person: 'border-border bg-secondary text-foreground',
        more: 'border-input bg-background text-foreground',
        vacant: 'border-dashed border-input bg-background text-muted-foreground',
      },
    },
    defaultVariants: { size: 'md', tone: 'person' },
  },
);

export interface AvatarProps extends Omit<React.ComponentProps<'span'>, 'children'>, VariantProps<typeof avatarVariants> {
  /** One or two letters ("SR"), or a count ("+3") with `tone="more"`. */
  initials?: string;
  /** Who it is ("Sam Rivera, President") when no name is printed beside it. */
  label?: string;
}

export function Avatar({ initials = '', label, size, tone, className, ...props }: AvatarProps) {
  const a11y = label ? { role: 'img', 'aria-label': label, title: label } : { 'aria-hidden': true };
  return <span data-slot="avatar" className={cn(avatarVariants({ size, tone }), className)} {...a11y} {...props}>{initials}</span>;
}
