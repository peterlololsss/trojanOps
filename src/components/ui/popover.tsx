'use client';

import { Popover as PopoverPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({ className, align = 'center', sideOffset = 4, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn('z-50 max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border bg-popover p-4 text-popover-foreground shadow-overlay', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
