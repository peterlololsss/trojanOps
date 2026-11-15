'use client';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return <SheetPrimitive.Overlay data-slot="sheet-overlay" className={cn('fixed inset-0 z-50 bg-foreground/40', className)} {...props} />;
}

const sheetSides = {
  top: 'inset-x-0 top-0 max-h-[calc(100dvh-2rem)] rounded-b-md border-b',
  bottom: 'inset-x-0 bottom-0 max-h-[calc(100dvh-2rem)] rounded-t-md border-t',
  left: 'inset-y-0 left-0 h-dvh w-[calc(100%-2rem)] max-w-sm rounded-r-md border-r',
  right: 'inset-y-0 right-0 h-dvh w-[calc(100%-2rem)] max-w-sm rounded-l-md border-l',
} as const;

export function SheetContent({ className, children, side = 'right', showCloseButton = true, ...props }: React.ComponentProps<typeof SheetPrimitive.Content> & { readonly side?: keyof typeof sheetSides; readonly showCloseButton?: boolean }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn('fixed z-50 flex flex-col gap-4 overflow-y-auto bg-background p-6 text-foreground shadow-overlay', sheetSides[side], className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close panel" title="Close panel">
            <X className="size-4" aria-hidden="true" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-2 pr-8', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 pt-4', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn('text-xl leading-7 font-semibold', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
