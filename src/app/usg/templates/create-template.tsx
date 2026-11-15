'use client';

import { useActionState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { UsgTarget } from '@/lib/distribution/usg-view';
import { ErrorNotice, selectClass } from './console-ui';
import { createTemplateAction } from './create-action';

export function CreateTemplate({ targets }: { readonly targets: readonly UsgTarget[] }) {
  const [state, action, pending] = useActionState(createTemplateAction, { error: null });
  return <Dialog>
    <DialogTrigger asChild><Button><Plus className="size-4" aria-hidden="true" />Create template</Button></DialogTrigger>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Create agent template</DialogTitle>
        <DialogDescription>Publish version 1, then review its settings and distribute it to clubs.</DialogDescription>
      </DialogHeader>
      <form action={action} className="space-y-4" aria-busy={pending}>
        <ErrorNotice message={state.error} />
        <div><label htmlFor="new-template-name" className="mb-1 block font-semibold">Name</label>
          <Input id="new-template-name" name="name" maxLength={120} required placeholder="Meeting summary" /></div>
        <div><label htmlFor="new-template-purpose" className="mb-1 block font-semibold">Purpose</label>
          <Input id="new-template-purpose" name="purpose" required placeholder="Summarizes decisions, owners and next steps from club meetings." /></div>
        <div><label htmlFor="new-template-instructions" className="mb-1 block font-semibold">Instructions</label>
          <Textarea id="new-template-instructions" name="systemPrompt" rows={4} required
            defaultValue="Summarize decisions, owners and next steps from the club documents provided. Cite the document behind each fact. If information is missing, say so and do not guess." /></div>
        <fieldset><legend className="mb-2 font-semibold">Document sources</legend>
          <div className="grid grid-cols-2 gap-2">{[
            ['minutes', 'Meeting minutes'], ['archive', 'Club archive'], ['public', 'Public club documents'], ['rulebook', 'USG guidelines'],
          ].map(([value, name]) => <label key={value} className="flex items-center gap-2"><input className="size-4 accent-primary" type="checkbox" name="sourceKinds" value={value} defaultChecked={value === 'minutes' || value === 'archive'} />{name}</label>)}</div>
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <div><label htmlFor="new-template-distribution" className="mb-1 block font-semibold">Distribution</label>
            <select id="new-template-distribution" name="distribution" className={selectClass} defaultValue="default">
              <option value="default">Default — clubs may disable</option><option value="required">Required — always enabled</option><option value="optional">Optional — clubs install</option>
            </select></div>
          <div><label htmlFor="new-template-target" className="mb-1 block font-semibold">Target</label>
            <select id="new-template-target" name="target" className={selectClass} defaultValue="all">{targets.map(target => <option key={target.slug} value={target.slug}>{target.name} ({target.clubs.length})</option>)}</select></div>
        </div>
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">All members can use this agent after installation. It reads up to Members documents and uses Economy. You can adjust these settings on the template page before distribution.</p>
        <DialogFooter><DialogClose asChild><Button type="button" variant="secondary" disabled={pending}>Cancel</Button></DialogClose>
          <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create template'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
