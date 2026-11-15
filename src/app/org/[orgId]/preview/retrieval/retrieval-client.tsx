'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { accessDecisions, tierLabels } from '@/components/inspector/access-labels';
import { fieldClass } from '@/components/inspector/field';
import { runRetrievalTest } from '@/lib/documents/knowledge-actions';
import type { PreviewPageData } from '@/lib/documents/preview-page';
import type { RetrievalHit, testRetrieval } from '@/lib/documents/retrieval-test';
import { formatPacific } from '@/lib/documents/library-view';

type Result = Awaited<ReturnType<typeof testRetrieval>>;
const fixes = { allowed: '', not_granted: 'To change it, edit who can read the document.', outside_sources: 'Add the source in the catalog, if its template allows.', above_max_tier: "Set by the USG template. Ask USG to raise the agent's max tier." };

function Highlight({ text, matched }: { readonly text: string; readonly matched: string[] }) {
  return <>{text.split(/([a-z0-9]+)/i).map((part, i) => matched.includes(part.toLowerCase().replace(/s$/, '')) ? <mark key={i} className="bg-gold-25 text-foreground">{part}</mark> : part)}</>;
}

function Hit({ hit, orgId, blocked }: { readonly hit: RetrievalHit; readonly orgId: string; readonly blocked?: boolean }) {
  const decision = accessDecisions[hit.reason];
  const Icon = decision.icon;
  return <li className="border-t border-border py-4"><div className="flex flex-wrap items-baseline gap-2"><span className="font-mono tabular-nums">{hit.score.toFixed(2)}</span><span className="font-semibold">{hit.title}</span><span className="rounded-sm border border-border px-2 text-xs">{tierLabels[hit.tier]}</span></div><p className="mt-1 text-sm text-muted-foreground">Chunk {String(hit.chunk.n).padStart(2, '0')} · {hit.chunk.heading}</p>
    <p className="mt-2 max-w-[65ch] whitespace-pre-wrap break-words text-[16px] leading-6"><Highlight text={hit.chunk.text} matched={hit.matched} /></p>
    {blocked && <><p className="mt-2 flex items-center gap-1 font-semibold"><Icon aria-hidden className="size-4 shrink-0" />{decision.label}</p><p className="mt-1 text-sm text-muted-foreground">{fixes[hit.reason]}</p></>}
    <Link href={`/org/${orgId}/documents/${hit.documentId}#chunk-${String(hit.chunk.n).padStart(2, '0')}`} className="mt-2 inline-block text-sm text-primary underline">Open in document</Link>
  </li>;
}

export function RetrievalClient({ data, starters }: { readonly data: PreviewPageData; readonly starters: Record<string, string[]> }) {
  const [agentId, setAgentId] = useState(data.selectedAgent?.id ?? '');
  const [subject, setSubject] = useState('member');
  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState(3);
  const [threshold, setThreshold] = useState(0.3);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [history, setHistory] = useState<Array<{ result: Result; question: string }>>([]);
  async function test(as = subject) {
    if (pending) return;
    if (!question.trim() || question.trim().length > 200) { setError('Write a question of 1–200 characters.'); return; }
    setPending(true); setError(null); setSubject(as);
    try {
      const reply = await runRetrievalTest(data.org.id, { installationId: agentId, question, subject: as, topK, scoreThreshold: threshold });
      if (reply.ok) { setResult(reply.result); setShowAll(false); setHistory((old) => [{ result: reply.result, question }, ...old].slice(0, 10)); }
      else setError(reply.message);
    } catch (cause) { if (cause instanceof Error) setError("Couldn't run the test. Check your connection and try again."); else throw cause; }
    finally { setPending(false); }
  }
  if (!data.agents.length) return <p className="rounded-md border border-border p-4">No agents are installed yet. <Link href={`/org/${data.org.id}/catalog`} className="text-primary underline">Open catalog</Link> to install one.</p>;
  return <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]"><div className="space-y-6"><form onSubmit={(e) => { e.preventDefault(); void test(); }} className="space-y-4 rounded-md border border-border p-4" aria-busy={pending}>
    <label className="block space-y-1"><span className="block font-semibold">Agent</span><select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={fieldClass}>{data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label className="block space-y-1"><span className="block font-semibold">Test as</span><select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>{data.matrix?.subjects.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
    <label className="block space-y-1"><span className="block font-semibold">Question</span><textarea rows={3} value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} className="w-full rounded-md border border-input p-3" /><span className="block text-xs text-muted-foreground">Up to 200 characters. Ask it the way that person would.</span></label>
    <details><summary className="cursor-pointer py-2 font-semibold">Retrieval settings</summary><div className="mt-2 grid grid-cols-2 gap-3"><label className="space-y-1"><span className="block">Top K</span><input type="number" min={1} max={10} value={topK} onChange={(e) => setTopK(Number(e.target.value))} className={fieldClass} /></label><label className="space-y-1"><span className="block">Score threshold</span><input type="number" min={0} max={1} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={fieldClass} /></label></div><p className="mt-2 text-xs text-muted-foreground">For this test only.</p></details>
    {error && <p role="alert" className="flex items-start gap-2 text-primary"><AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</p>}
    <Button type="submit" disabled={pending} className="min-w-36"><Search aria-hidden className="size-4" />{pending ? 'Testing…' : 'Test retrieval'}</Button>
    <p className="text-xs leading-5 text-muted-foreground">Nothing runs, nothing is billed, and questions aren&apos;t saved.</p>
    {(starters[agentId] ?? []).map((starter) => <button key={starter} type="button" onClick={() => setQuestion(starter)} className="block w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent">{starter}</button>)}
  </form>{history.length > 0 && <section><h2 className="mb-2 font-semibold">Tests in this session</h2><ul className="divide-y divide-border">{history.map((h, i) => <li key={`${h.result.testedAt}-${i}`}><button type="button" onClick={() => { setResult(h.result); setQuestion(h.question); setAgentId(h.result.agent.id); setSubject(h.result.subject.key); }} className="w-full py-3 text-left text-sm hover:bg-accent"><span className="block text-xs text-muted-foreground">{formatPacific(new Date(h.result.testedAt))} · {h.result.subject.label}</span>{h.question} · {h.result.hits.length} hits</button></li>)}</ul></section>}</div>
  <section aria-label="Retrieval results" aria-busy={pending} className="min-w-0 rounded-md border border-border p-4">
    <span title="Scores count shared words. The permission check is real and is the same one a run uses." className="mb-4 inline-block rounded-sm border border-border px-2 py-1 text-xs">Demo scores</span>
    {pending ? <div role="status" className="space-y-4"><span className="sr-only">Testing retrieval</span>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div> : result ? <><h2 className="text-[20px] font-semibold">{result.hits.length} chunks retrieved for {result.subject.label} · {result.agent.name}</h2><p className="mt-2 text-sm">By position: {result.byPosition.map((s) => <button key={s.key} type="button" onClick={() => void test(s.key)} className="mr-2 min-h-9 text-primary underline">{s.label} {s.count}</button>)}</p>
      {!result.hits.length && <p className="my-4 bg-muted p-4">No chunks scored at least {threshold.toFixed(2)} for this position through this agent. Lower the threshold, or check that the answer is in a readable document.</p>}
      <ol className="mt-3">{result.hits.map((h) => <Hit key={`${h.documentId}-${h.chunk.n}`} hit={h} orgId={data.org.id} />)}</ol>
      <h3 className="mt-6 text-[20px] font-semibold">Kept out by permissions · {result.keptOut.length} chunks</h3><p className="mt-2 text-sm text-muted-foreground">These met the score threshold, but {result.subject.label} cannot read them through {result.agent.name}.</p><ol className="mt-3">{(showAll ? result.keptOut : result.keptOut.slice(0, 3)).map((h) => <Hit key={`${h.documentId}-${h.chunk.n}`} hit={h} orgId={data.org.id} blocked />)}</ol>{result.keptOut.length > 3 && !showAll && <Button type="button" variant="ghost" onClick={() => setShowAll(true)}>Show {result.keptOut.length - 3} more</Button>}
    </> : <div className="py-8"><h2 className="font-semibold">Test what an agent retrieves for a position.</h2><p className="mt-2 text-muted-foreground">Choose an agent, a position and a question. Nothing runs, nothing is billed, and questions aren&apos;t saved.</p></div>}
  </section></div>;
}
