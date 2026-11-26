import { createContext, useContext } from 'react'
import { withOwnWords } from './page-layouts'
import { about, categoryBySlug, projectsIn, site } from './site'

// The words each page shows, gathered in one object per page. The website shows them as they are;
// the design editor shows a copy with your unpublished changes, so the canvas is the real page.
// Fixed wording that is not yet stored in a content file has its standard text here.

export const homeWords = () => withOwnWords('home', {
  home_intro: site.home_intro,
  home_byline: site.home_byline ?? '',
  areas_of_focus: site.areas_of_focus,
  availability: site.availability ?? '',
  clock: { city: site.clock?.city ?? '', time_zone: site.clock?.time_zone ?? 'Europe/London', line: site.clock?.line ?? '', show: site.clock?.show !== false && !!site.clock, weather: site.clock?.weather === true, latitude: site.clock?.latitude, longitude: site.clock?.longitude },
  labels: { focus: 'Areas of Focus', work: 'Selected Projects', cv_view: 'View CV (PDF)' },
})

export const aboutWords = () => withOwnWords('about', { ...about, name: site.name, labels: { kicker: 'About', intro: 'Intro', skills: 'Skills', education: 'Education', experience: 'Experience', languages: 'Languages' } })

export const projectsWords = () => withOwnWords('projects', { title: 'Projects', intro: site.projects_intro ?? '' })
export const categoryWords = (slug: string) => {
  const c = categoryBySlug(slug)
  return withOwnWords(`category:${slug}`, { slug, title: c?.name ?? slug, intro: c?.intro ?? '', count: projectsIn(slug).length, labels: { category: 'Category' } })
}
export type ListingWords = { slug?: string; title: string; intro: string; count?: number; labels?: { category: string } }

export const headerWords = () => withOwnWords('header', { name: site.name, nav: { about: 'About', projects: 'Projects', cv: 'CV', email: 'Email', instagram: 'Instagram', linkedin: 'LinkedIn', menu_cv: 'Download CV' } })
export type HeaderWords = ReturnType<typeof headerWords>
export const footerWords = () => withOwnWords('footer', { kicker: 'Contact', title: "Let's talk", email: site.email, top: 'Back to top ↑', pages: { home: 'Home', about: 'About', projects: 'Projects' }, social: { instagram: 'Instagram ↗', linkedin: 'LinkedIn ↗' }, credit: 'Zafran Zakaria. All rights reserved.' })
export type FooterWords = ReturnType<typeof footerWords>

// The words of the page being shown (one page at a time).
export const PageWords = createContext<unknown>(null)
export function usePageWords<T>(standard: () => T): T {
  return (useContext(PageWords) as T | null) ?? standard()
}

// The shared parts, shown on every page.
export const SharedWords = createContext<{ header: HeaderWords; footer: FooterWords } | null>(null)
export const useHeaderWords = () => useContext(SharedWords)?.header ?? headerWords()
export const useFooterWords = () => useContext(SharedWords)?.footer ?? footerWords()
