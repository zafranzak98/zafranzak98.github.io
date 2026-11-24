import { defineCollection, defineConfig, defineSingleton } from '@content-collections/core'
import { addressOf } from './src/lib/project-urls.js'
import { z } from 'zod'

// Preview builds (the test website) include drafts. Production builds leave them out
// completely, so no draft text or draft image path is ever part of the production site.
const PREVIEW = process.env.VITE_SITE_MODE === 'preview'

const image = z.object({
  image: z.string().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
})
const figure = z.object({ figure: z.string(), label: z.string() })

// The five approved palette colours. No others.
export const OPENING_COLOURS = ['Olive', 'Sage', 'Light sage', 'Off-white', 'Terracotta'] as const
export const PROJECT_TYPES = [
  'Individual project',
  'Team project (lead)',
  'Team project (member)',
  'Freelance',
  'University project',
  'Personal project',
] as const
export const DESIGNS = ['cancel-me-not', 'fc-yeah', 'evoke', 'about-face', 'bersih'] as const

const projects = defineCollection({
  name: 'projects',
  directory: './content/projects',
  include: '*.md',
  parser: 'frontmatter-only',
  schema: z.object({
    title: z.string().min(1).max(60),
    status: z.enum(['Draft', 'Published']),
    page_type: z.enum(['Full case study', 'Listed only']),
    category: z.string().min(1),
    // Web address override from the editor. Empty means the address follows the title.
    url: z.string().optional(),
    featured: z.boolean().optional(),
    homepage_label: z.string().max(70).optional(),
    order: z.number().optional(),
    design: z.enum(DESIGNS).optional(),
    summary: z.string().min(1).max(220),
    opening_colour: z.enum(OPENING_COLOURS),
    cover: image.optional(),
    cover_before: image.optional(),
    role: z.string().min(1).max(60),
    project_type: z.enum(PROJECT_TYPES),
    type_detail: z.string().optional(),
    when: z.string().min(1),
    year: z.number().int().optional(),
    deliverables: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    objective: z.string().optional(),
    what_i_did: z.string().optional(),
    what_team_did: z.string().optional(),
    research: z
      .object({
        stats: z.array(figure).optional(),
        text: z.string().optional(),
        extra: z.string().optional(),
        moodboard: image.optional(),
      })
      .optional(),
    key_piece: image.optional(),
    supporting: z.array(image).max(3).optional(),
    supporting_note: z.string().optional(),
    film: z.object({ url: z.string().optional(), caption: z.string().optional() }).optional(),
    context: z.object({ image: z.string().optional(), alt: z.string().optional(), text: z.string().optional() }).optional(),
    gallery: z.array(image).optional(),
    gallery_note: z.string().optional(),
    results_label: z.string().optional(),
    results: z.array(figure).max(4).optional(),
    outcome_note: z.string().optional(),
    skills: z.array(z.string()).optional(),
    link: z.object({ label: z.string(), url: z.string() }).optional(),
    // Section titles and small labels on the page; empty ones use the standard wording.
    labels: z
      .object(Object.fromEntries(['overview', 'research', 'work', 'outcomes', 'role', 'type', 'when', 'deliverables', 'tools', 'what_i_did', 'what_team_did', 'skills'].map((k) => [k, z.string().optional()])))
      .optional(),
    // Search and sharing. Each one falls back to the title, summary or cover image when empty.
    seo: z
      .object({ title: z.string().max(60).optional(), description: z.string().max(160).optional(), image: z.string().optional() })
      .optional(),
  }),
  transform: (doc, { skip }) => {
    if (doc.status === 'Draft' && !PREVIEW) return skip('draft')
    // slug: the file name, the project's permanent internal ID. address: the last part of its URL.
    return { ...doc, slug: doc._meta.path, address: addressOf(doc) }
  },
})

const categories = defineCollection({
  name: 'categories',
  directory: './content/categories',
  include: '*.md',
  parser: 'frontmatter-only',
  schema: z.object({
    name: z.string().min(1).max(40),
    intro: z.string().optional(),
    order: z.number().optional(),
  }),
  transform: (doc) => ({ ...doc, slug: doc._meta.path }),
})

const about = defineSingleton({
  name: 'about',
  filePath: './content/about.md',
  parser: 'frontmatter-only',
  schema: z.object({
    intro: z.string(),
    intro_more: z.string().optional(),
    languages: z.array(z.string()).optional(),
    portrait: image.optional(),
    portrait_caption: z.string().optional(),
    skills: z.array(z.object({ title: z.string(), text: z.string().optional() })).optional(),
    education: z
      .array(
        z.object({
          qualification: z.string(),
          course: z.string().optional(),
          institution: z.string().optional(),
          years: z.string().optional(),
          result: z.string().optional(),
          note: z.string().optional(),
        }),
      )
      .optional(),
    experience: z
      .array(
        z.object({
          years: z.string(),
          role: z.string(),
          organisation: z.string().optional(),
          note: z.string().optional(),
        }),
      )
      .optional(),
  }),
})

const site = defineSingleton({
  name: 'site',
  filePath: './content/site.yml',
  parser: 'yaml',
  schema: z.object({
    site_title: z.string(),
    name: z.string(),
    home_intro: z.string(),
    areas_of_focus: z.array(z.object({ label: z.string(), category: z.string().optional() })),
    projects_intro: z.string().optional(),
    cv: z.string().optional(),
    email: z.string(),
    instagram: z.string().optional(),
    linkedin: z.string().optional(),
    credit_name: z.string().optional(),
    credit_url: z.string().optional(),
  }),
})

export default defineConfig({
  content: [projects, categories, about, site],
})
