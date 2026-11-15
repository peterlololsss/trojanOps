'use client';

import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn('flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:truncate', className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild><ChevronDown className="size-4 shrink-0" aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, children, position = 'popper', sideOffset = 4, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={cn('relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-40 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-overlay', position === 'popper' && 'min-w-[var(--radix-select-trigger-width)]', className)}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn('relative flex min-h-9 cursor-default items-center rounded-sm py-2 pr-8 pl-2 text-sm data-[highlighted]:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator><Check className="size-4" aria-hidden="true" /></SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label data-slot="select-label" className={cn('px-2 py-2 text-sm font-semibold', className)} {...props} />;
}

export function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}

export function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return <SelectPrimitive.ScrollUpButton className={cn('flex h-6 items-center justify-center', className)} {...props}><ChevronUp className="size-4" aria-hidden="true" /></SelectPrimitive.ScrollUpButton>;
}

export function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return <SelectPrimitive.ScrollDownButton className={cn('flex h-6 items-center justify-center', className)} {...props}><ChevronDown className="size-4" aria-hidden="true" /></SelectPrimitive.ScrollDownButton>;
}
