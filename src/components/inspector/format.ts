// Owner: C. Shared formatting for the run page and its inspector (ui-designer.md "Times and money").
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Micro-USD as "$0.42". */
export const money = (micro: number) => usd.format(micro / 1_000_000);

/** "Read 1 document", "Read 3 documents", "Read no documents". */
export function readCount(n: number): string {
  if (n === 0) return 'Read no documents';
  return `Read ${n} ${n === 1 ? 'document' : 'documents'}`;
}

/** A tool id as words: `submit_to_queue` → "Submit to queue". */
export function humanizeTool(tool: string): string {
  const words = tool.replace(/[_\-.]+/g, ' ').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : tool;
}
