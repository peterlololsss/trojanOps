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
  it('preserves the starting number of an ordered list', () => {
    expect(render('3. Third cited document')).toMatch(/<ol\b[^>]*\bstart="3"/);
  });
});
