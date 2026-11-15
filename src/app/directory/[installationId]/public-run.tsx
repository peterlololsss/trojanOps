'use client';

import { useActionState, useRef, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { Inspector } from '@/components/inspector';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PublicRunState } from './run-state';

export function PublicRun({ agentName, isMock, action }: {
  readonly agentName: string;
  readonly isMock: boolean;
  readonly action: (previous: PublicRunState, data: FormData) => Promise<PublicRunState>;
}) {
  const submitting = useRef(false);
  const [question, setQuestion] = useState('');
  const [state, formAction, pending] = useActionState<PublicRunState, FormData>(async (previous, data) => {
    try {
      return await action(previous, data);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      return { status: 'error', code: 'unavailable', message: 'Could not confirm the run. Check your connection and try again. A run may already have been billed.' };
    } finally {
      submitting.current = false;
    }
  }, { status: 'idle' });

  return <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,720px)_384px]">
    <div className="min-w-0 max-w-[720px]">
      {isMock && <p className="mb-4 text-muted-foreground">Demo runtime: placeholder answer</p>}
      <form action={formAction} onSubmit={(event) => {
        if (submitting.current) { event.preventDefault(); return; }
        submitting.current = true;
      }} className="space-y-3" aria-busy={pending}>
        <Label htmlFor="question">Your question</Label>
        <Textarea id="question" name="question" required maxLength={8000} rows={4}
          aria-describedby="question-help" value={question} onChange={(event) => setQuestion(event.target.value)} readOnly={pending} />
        <p id="question-help" className="text-muted-foreground">Up to 8,000 characters. This public agent can read only public documents. Runs are billed to the publishing club.</p>
        <Button type="submit" disabled={pending} variant={pending ? 'secondary' : 'default'} className="min-w-32 disabled:opacity-100">Run agent</Button>
        <p role="status" aria-live="polite" className="min-h-5 text-muted-foreground">{pending ? 'Checking access and running agent' : ''}</p>
      </form>
      {state.status === 'error' && <Alert variant="destructive" className="mt-4">
        <CircleAlert aria-hidden="true" /><div>
          <AlertTitle>{state.code === 'quota_exceeded' ? 'Quota reached' : 'Run could not finish'}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </div>
      </Alert>}
      {state.status === 'success' && <section aria-label="Latest run transcript" className="mt-6 break-words [overflow-wrap:anywhere]">
        <h2 className="text-xl font-semibold leading-7">Latest run</h2>
        <div className="mt-4 border-y py-4">
          <p className="mb-2 font-semibold">You</p>
          <p className="whitespace-pre-wrap text-base leading-6">{state.input}</p>
        </div>
        <div className="border-b py-4">
          <p className="mb-2 font-semibold">{agentName}</p>
          <p className="whitespace-pre-wrap text-base leading-6">{state.result.reply}</p>
          <details className="mt-4">
            <summary className="w-fit cursor-pointer py-2 text-primary underline underline-offset-4">AI-generated · View sources</summary>
            {state.result.citations.length ? <ul className="space-y-3 py-2">{state.result.citations.map((citation, index) => <li key={`${citation.documentId}:${index}`}>
              <p className="font-semibold">{state.result.inspector.readInRun.find((doc) => doc.id === citation.documentId)?.title ?? 'Source document'}</p>
              <blockquote className="mt-1 whitespace-pre-wrap">{citation.quote}</blockquote>
            </li>)}</ul> : <p className="py-2 text-muted-foreground">No document sources were cited in this answer.</p>}
          </details>
        </div>
      </section>}
    </div>
    <div className="min-w-0 break-words [overflow-wrap:anywhere] [&>aside]:w-full">
      {state.status === 'success' ? <Inspector inspector={state.result.inspector} /> : <aside aria-label="Run inspector" className="border-t py-4 xl:border-l xl:border-t-0 xl:px-4">
        <h2 className="text-xl font-semibold leading-7">Run inspector</h2>
        <p className="mt-2 text-muted-foreground">Run the agent to review its grants, sources, documents, versions and billing.</p>
      </aside>}
    </div>
  </div>;
}
