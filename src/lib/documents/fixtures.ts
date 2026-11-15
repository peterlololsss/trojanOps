import { DOCUMENT } from '@db/seed/ids';

export const STARTERS: Readonly<Record<string, string[]>> = {
  'hacksc-handoff': ['This is my first time organizing a hackathon. What should I know?', 'What did the 2025–2026 president highlight in the handoff?', 'Show me HackSC’s financial documents.'],
  'hacksc-meeting-summary': ['Summarize our organizing decisions and next steps.', 'Who owns venue confirmation and check-in?', 'What changed after last year’s event?'],
  'hacksc-funding-precheck': ['How does the HackSC event budget compare with the USG annual limit?', 'Which funding approvals should we obtain before booking vendors?', 'What should the treasurer verify before submitting a funding request?'],
  'recruiting-qa': ['Do I need experience to join Startup Club?', 'How does recruiting work?', 'Does membership cost anything?'],
  'showcase-qa': ['When and where is the spring showcase?', 'Are tickets free for students?', 'How can I help backstage?'],
  handoff: ['What did we decide at the Oct 8 meeting?', 'How did pitch night go last year?', 'What should a new treasurer know first?'],
  'funding-precheck': ['How much of the annual cap does the spring budget use?', 'When are funding requests due?', 'Submit the founder panel request for $1,800 to the USG queue.'],
  'event-planning': ['How far ahead should we book a room?', 'What should we change about check-in?', 'What should an event organizer prepare?'],
  'usg-review-assistant': ['What do reviewers check first?', 'Which requests should be flagged?', 'What are the annual funding limits?'],
  'meeting-recap': ['Summarize the decisions from the Oct 8 meeting.', 'Which action items still need follow-up?', 'What should we carry into the next meeting?'],
  'event-retrospective': ['What went well at last year’s pitch night?', 'What should we improve for the next event?', 'Summarize the lessons for a new event organizer.'],
  'archery-getting-started': ['How can I try archery with the club?', 'Do I need my own equipment?', 'What should I know before my first practice?'],
  'audition-guide': ['How do Dance Club auditions work?', 'What should I prepare for an audition?', 'Can beginners audition?'],
};

export const DEMO_INDEX = { label: 'Demo index', maxChunkChars: 800, minIndexableChars: 40, queuedMs: 3000, msPerChunk: 2000 } as const;
export interface DemoChunk {
  readonly n: number; readonly heading: string; readonly text: string;
  readonly start: number; readonly chars: number; readonly tokens: number;
}
export type IndexStatus =
  | { readonly state: 'queued' }
  | { readonly state: 'indexing'; readonly done: number; readonly total: number }
  | { readonly state: 'ready' }
  | { readonly state: 'error'; readonly reason: 'too_short'; readonly message: string; readonly fix: string };

export function demoChunks(bodyMd: string): DemoChunk[] {
  const headings = [...bodyMd.matchAll(/^#{2,3}[ \t]+([^\r\n]+).*$/gm)];
  const title = /^#[ \t]+[^\r\n]*(?:\r?\n|$)\s*/.exec(bodyMd);
  const sections = [
    { heading: 'Introduction', start: title?.[0].length ?? 0, end: headings[0]?.index ?? bodyMd.length },
    ...headings.map((h, i) => ({ heading: h[1].trim(), start: h.index + h[0].length, end: headings[i + 1]?.index ?? bodyMd.length })),
  ];
  const chunks: DemoChunk[] = [];
  for (const section of sections) {
    let start = section.start;
    while (start < section.end) {
      while (start < section.end && /\s/.test(bodyMd[start])) start++;
      if (start === section.end) break;
      let end = Math.min(section.end, start + DEMO_INDEX.maxChunkChars);
      if (end < section.end) {
        const paragraph = bodyMd.lastIndexOf('\n\n', end);
        const word = bodyMd.lastIndexOf(' ', end);
        if (paragraph > start) end = paragraph;
        else if (word > start) end = word;
      }
      const text = bodyMd.slice(start, end).trimEnd();
      if (text) chunks.push({ n: chunks.length + 1, heading: section.heading, text, start, chars: text.length, tokens: Math.ceil(text.length / 4) });
      start = end;
    }
  }
  return chunks;
}

const seededIds = new Set<string>(Object.values(DOCUMENT));
export function demoStatus(doc: { id: string; bodyMd: string; createdAt: Date }, at: Date): IndexStatus {
  if (seededIds.has(doc.id)) return { state: 'ready' };
  const total = demoChunks(doc.bodyMd).length;
  if (doc.bodyMd.trim().length < DEMO_INDEX.minIndexableChars || !total) return { state: 'error', reason: 'too_short', message: 'Too short to index.', fix: 'Upload a version with at least one full sentence and 40 characters of text.' };
  const age = at.getTime() - doc.createdAt.getTime();
  if (age < DEMO_INDEX.queuedMs) return { state: 'queued' };
  const done = Math.min(total, Math.floor((age - DEMO_INDEX.queuedMs) / DEMO_INDEX.msPerChunk));
  return done === total ? { state: 'ready' } : { state: 'indexing', done, total };
}

const stopWords = new Set('a an and are as at be by can did do does for from had has have how i in is it its me my of on or our should that the their them there these they this to was we what when where which who will with would you your'.split(' '));
function words(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !stopWords.has(w)).map((w) => w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))];
}
export function demoScore(question: string, chunk: Pick<DemoChunk, 'heading' | 'text'>): { score: number; matched: string[] } {
  const query = words(question);
  const terms = new Set(words(`${chunk.heading} ${chunk.text}`));
  const matched = query.filter((w) => terms.has(w));
  return { score: query.length ? matched.length / query.length : 0, matched };
}
