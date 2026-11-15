import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from '@/components/ui/markdown';

const render = (text: string) => renderToStaticMarkup(createElement(Markdown, { text, renderCitation: (n) => createElement('button', {}, `Source ${n}`) }));

describe('safe answer Markdown', () => {
  it('renders headings, emphasis, lists and code as semantic elements', () => {
    const html = render('# Heading\n\n**Bold** and *italic* with `code`.\n\n1. One\n2. Two\n\n```\n<p>literal</p>\n```');
    for (const tag of ['h2', 'strong', 'em', 'code', 'ol', 'pre']) expect(html).toContain(`<${tag}`);
    expect(html).toContain('&lt;p&gt;literal&lt;/p&gt;');
  });
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,bad', '//evil.example'])('does not make an active link for %s', (url) => {
    expect(render(`[click](${url})`)).not.toContain('href=');
  });
  it('escapes raw HTML and allows ordinary HTTPS links', () => {
    const html = render('<script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[USC](https://usc.edu)');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('href="https://usc.edu"');
  });
  it('renders citation buttons only outside inline and fenced code', () => {
    const html = render('Answer [1] and `[2]`.\n\n```\n[3]\n```');
    expect(html).toContain('<button>Source 1</button>');
    expect(html).not.toContain('Source 2');
    expect(html).not.toContain('Source 3');
  });
  // Answer playback renders the reply word by word, so a prefix can end in a bare list marker.
  // A marker the item pattern missed used to loop forever and crash the tab.
  it('renders every word-by-word prefix of a reply, including a bare list marker', () => {
    const reply = 'Here is what this run could read:\n\n1. **Spring 2026 budget:** Totals. [1]\n\n- Item\n\n2.\tTab';
    const words = reply.split(/(?<=\s)/);
    for (let n = 0; n <= words.length; n++) expect(render(words.slice(0, n).join(''))).toContain('<div');
    expect(render('Here:\n\n1. ')).toContain('<ol');
    expect(render('Here:\n\n- ')).toContain('<ul');
  });
  it('preserves the starting number of an ordered list', () => {
    expect(render('3. Third cited document')).toMatch(/<ol\b[^>]*\bstart="3"/);
  });
});
