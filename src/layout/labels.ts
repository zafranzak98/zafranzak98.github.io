import type { Project } from '#/lib/site'

// The fixed words on a case study page (section titles and small labels). Each project can
// change them in its "labels" field; anything left empty uses the wording below.
export const LABELS = {
  overview: 'Overview',
  research: 'Research & thinking',
  work: 'The work',
  outcomes: 'Outcomes',
  role: 'My role',
  type: 'Type',
  when: 'When',
  deliverables: 'Deliverables',
  tools: 'Tools',
  what_i_did: 'What I did',
  what_team_did: 'What the team did',
  skills: 'Skills shown',
} as const
export type LabelKey = keyof typeof LABELS

export const label = (p: Project, key: LabelKey) => (p.labels as Partial<Record<LabelKey, string>> | undefined)?.[key] || LABELS[key]
