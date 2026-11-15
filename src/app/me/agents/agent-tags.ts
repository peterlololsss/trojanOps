// Topic tags for the agents a student sees, by template slug. A slug without an entry (a template a
// club or USG added later) gets no tags.
const TAGS: Readonly<Record<string, readonly string[]>> = {
  'funding-precheck': ['Funding', 'Budget'],
  'event-planning': ['Events', 'Planning'],
  'recruiting-qa': ['Recruiting', 'FAQ'],
  'showcase-qa': ['Events', 'Performances'],
  handoff: ['Onboarding', 'Minutes'],
  'usg-review-assistant': ['Funding', 'Review'],
  'meeting-recap': ['Meetings', 'Decisions'],
  'event-retrospective': ['Events', 'Archive'],
  'archery-getting-started': ['Archery', 'Joining'],
  'audition-guide': ['Auditions', 'Performances'],
};

export function agentTags(templateSlug: string): readonly string[] {
  return Object.hasOwn(TAGS, templateSlug) ? TAGS[templateSlug] : [];
}
