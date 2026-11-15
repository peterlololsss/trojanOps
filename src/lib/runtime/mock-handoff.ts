import type { AccessibleDocument } from '../contracts';

/** Deterministic source excerpts for the handoff case, after gateway RLS filtering. */
export function mockHandoff(input: string, documents: AccessibleDocument[]) {
  const label = '**Demo answer · Mock runtime, no model call.**';
  const disclaimer = `${label} These excerpts come from the permitted scenario documents.`;
  if (/finance|financial|budget|expenses|sponsor/i.test(input)) {
    return {
      reply: `${label}\n\nSorry, I don’t have permission to access the club’s financial documents, so I can’t share financial information. Ask the president or treasurer for authorized access or an approved summary.`,
      citations: [],
    };
  }
  const sections = [
    { heading: 'Previous event process', label: 'Previous process' },
    { heading: "President's highlighted lesson", label: '2025–2026 president’s highlighted lesson' },
    { heading: 'What each stage needs', label: 'Stage-by-stage checks' },
    { heading: 'Decisions for the next event', label: 'Updated organizing plan' },
    { heading: 'Ownership', label: 'Next steps and owners' },
  ];
  const excerpts = sections.flatMap((section) => {
    for (const document of documents) {
      const start = document.bodyMd.indexOf(`## ${section.heading}\n`);
      if (start < 0) continue;
      const rest = document.bodyMd.slice(start + section.heading.length + 4);
      const end = rest.indexOf('\n## ');
      const quote = (end < 0 ? rest : rest.slice(0, end)).trim();
      if (quote) return [{ label: section.label, document, quote }];
    }
    return [];
  });
  const cited = [...new Map(excerpts.map((excerpt) => [excerpt.document.id, excerpt.document])).values()];
  return {
    reply: [disclaimer, ...excerpts.map((excerpt) =>
      `### ${excerpt.label}\n\n${excerpt.quote}\n\n[${cited.findIndex((document) => document.id === excerpt.document.id) + 1}]`),
    ...(excerpts.length ? [] : ['No permitted handoff records are available. Ask the club president to add source material.'])].join('\n\n'),
    citations: cited.map((document) => ({ documentId: document.id, quote: excerpts.find((excerpt) => excerpt.document.id === document.id)?.quote ?? '' })),
  };
}
