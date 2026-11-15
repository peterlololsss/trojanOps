import { createElement, Fragment, type ReactNode } from 'react';

export interface MarkdownProps {
  readonly text: string;
  readonly renderCitation?: (n: number) => ReactNode;
}

function safeLink(url: string): boolean {
  return /^(https?:\/\/|mailto:|#|\/(?!\/))/i.test(url) && !url.includes('\\');
}

function inline(text: string, citation?: MarkdownProps['renderCitation']): ReactNode[] {
  const tokens = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\)|\[\d+\]|\*[^*\n]+\*|_[^_\n]+_)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(tokens)) {
    nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = match.index;
    if (token.startsWith('`')) nodes.push(<code key={key} className="rounded-sm bg-muted px-1 font-mono text-sm">{token.slice(1, -1)}</code>);
    else if (token.startsWith('**')) nodes.push(<strong key={key}>{inline(token.slice(2, -2), citation)}</strong>);
    else if (/^\[\d+\]$/.test(token)) nodes.push(<Fragment key={key}>{citation ? citation(Number(token.slice(1, -1))) : token}</Fragment>);
    else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\((.*)\)$/.exec(token);
      nodes.push(link && safeLink(link[2]) ? <a key={key} href={link[2]} rel="noopener noreferrer" className="text-primary underline underline-offset-4">{link[1]}</a> : token);
    } else nodes.push(<em key={key}>{inline(token.slice(1, -1), citation)}</em>);
    cursor = match.index + token.length;
  }
  nodes.push(text.slice(cursor));
  return nodes;
}

export function Markdown({ text, renderCitation }: MarkdownProps) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = i;
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(<pre key={key} className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-sm"><code>{code.join('\n')}</code></pre>);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(createElement(`h${Math.min(heading[1].length + 1, 6)}`, { key, className: 'mt-6 mb-2 font-semibold text-xl leading-7' }, inline(heading[2], renderCitation)));
      i++; continue;
    }
    const list = /^(?:([-*])|\d+\.)\s+/.exec(line);
    if (list) {
      const items: ReactNode[] = [];
      const pattern = list[1] ? /^[-*]\s+(.+)$/ : /^\d+\.\s+(.+)$/;
      while (i < lines.length) {
        const item = pattern.exec(lines[i]);
        if (!item) break;
        items.push(<li key={i}>{inline(item[1], renderCitation)}</li>);
        i++;
      }
      blocks.push(createElement(list[1] ? 'ul' : 'ol', { key, ...(!list[1] ? { start: Number.parseInt(line, 10) } : {}), className: `${list[1] ? 'list-disc' : 'list-decimal'} space-y-2 pl-6` }, items));
      continue;
    }
    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,6}\s|```|[-*]\s|\d+\.\s)/.test(lines[i])) paragraph.push(lines[i++]);
    blocks.push(<p key={key} className="whitespace-pre-wrap">{inline(paragraph.join('\n'), renderCitation)}</p>);
  }
  return <div className="space-y-4 break-words text-base leading-6 [overflow-wrap:anywhere]">{blocks}</div>;
}
