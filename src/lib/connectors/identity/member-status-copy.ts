// Owner: D. Membership status describes a person's relationship to an organization, not an office.
export const memberStatusLabels = {
  active: 'Active member',
  left: 'Left organization',
  none: 'No membership',
} as const;

/** Active and left count person–organization pairs; noMembership counts people with no history. */
export function memberStatusSummary(people: number, active: number, left: number, noMembership: number): string {
  const peopleLabel = people === 1 ? 'person' : 'people';
  const noHistory = noMembership === 1 ? '1 person has' : `${noMembership} people have`;
  return `This directory lists ${people} ${peopleLabel}. Membership status is Active member for ${active} person–organization pairs and Left organization for ${left}; ${noHistory} no membership history. Left organization means no position in that organization remains active. A person can be active in one organization and have left another.`;
}
