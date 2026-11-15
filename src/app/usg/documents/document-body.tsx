// Owner: C. Renders a library document's Markdown text: headings, nested bulleted and numbered lists,
// and paragraphs. Everything else shows as plain text; nothing is interpreted as HTML.
import type { ReactNode } from 'react';

interface Item { text: string; children: List[] }
interface List { kind: 'list'; ordered: boolean; indent: number; items: Item[] }
type Block = { kind: 'heading'; level: number; text: string } | { kind: 'paragraph'; text: string } | List;

const HEADING = /^(#{1,6})\s+(.*)$/;
const ITEM = /^(\s*)([-*]|\d+[.)])\s+(.*)$/;

/** Splits Markdown text into headings, paragraphs and nested lists (indentation decides nesting). */
export function parseDocument(text: string): Block[] {
  const blocks: Block[] = [];
  let stack: List[] = []; let paragraph: string[] = [];
  const endParagraph = () => { if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') }); paragraph = []; };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { endParagraph(); stack = []; continue; }
    const heading = HEADING.exec(line);
    if (heading) { endParagraph(); stack = []; blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] }); continue; }
    const item = ITEM.exec(line);
    if (item) {
      endParagraph();
      const indent = item[1].replace(/\t/g, '  ').length; const ordered = /\d/.test(item[2]);
      while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
      let list = stack[stack.length - 1];
      if (!list || list.indent < indent) {
        const next: List = { kind: 'list', ordered, indent, items: [] };
        if (list?.items.length) list.items[list.items.length - 1].children.push(next); else blocks.push(next);
        stack.push(next); list = next;
      }
      list.items.push({ text: item[3], children: [] });
      continue;
    }
    // A wrapped line continues the last list item, or the current paragraph.
    const last = stack[stack.length - 1]?.items.at(-1);
    if (last) last.text = `${last.text} ${line.trim()}`; else paragraph.push(line.trim());
  }
  endParagraph();
  return blocks;
}

function ListView({ list, depth }: { list: List; depth: number }): ReactNode {
  const items = list.items.map((item, i) => <li key={i} className="pl-1">{item.text}
    {item.children.map((child, j) => <ListView key={j} list={child} depth={depth + 1} />)}</li>);
  const spacing = depth ? 'mt-1 space-y-1' : 'space-y-2';
  return list.ordered
    ? <ol className={`list-decimal pl-6 ${spacing}`}>{items}</ol>
    : <ul className={`${depth % 2 ? 'list-[circle]' : 'list-disc'} pl-6 ${spacing}`}>{items}</ul>;
}

export function DocumentBody({ text }: { text: string }) {
  return <div className="max-w-[720px] space-y-4 text-base leading-6">
    {parseDocument(text).map((block, i) => {
      if (block.kind === 'heading') return block.level <= 2
        ? <h2 key={i} className="pt-4 text-xl font-semibold leading-7">{block.text}</h2>
        : <h3 key={i} className="pt-2 text-base font-semibold leading-6">{block.text}</h3>;
      if (block.kind === 'paragraph') return <p key={i}>{block.text}</p>;
      return <ListView key={i} list={block} depth={0} />;
    })}
  </div>;
}
