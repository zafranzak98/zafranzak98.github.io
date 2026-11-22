// Project web addresses, worked out once for the whole site.
//
// Every project has two names:
//  - its file name in content/projects (for example about-face-beauty). This is its permanent
//    internal ID: images, colours and the editor use it, and it never changes.
//  - its web address (for example af-binary), the last part of its page's URL. By default this is
//    made from the current title, so renaming a project in the editor changes its address. Filling
//    in the editor's Web address field sets the address by hand instead, and a later title change
//    then leaves it alone. Emptying the field returns the project to the title-based address.
//
// Old addresses keep working: the build reads the save history and adds a redirect page for every
// address a project has had (scripts/redirects.mjs). The website and the build both use this file,
// so they always agree. Plain JavaScript so the build can run it with Node as well.

// Lowercase letters and numbers in groups joined by single hyphens, such as af-binary.
export const ADDRESS_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

// A title as a web address: accents removed, & spelt out, anything that is not a letter or a number
// becomes one hyphen. "We Matter Too: The Handbook of LGBTQ+" becomes we-matter-too-the-handbook-of-lgbtq.
export const slugify = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// The override from the editor's Web address field, if one is filled in.
export const overrideOf = (p) => (typeof p?.url === 'string' && p.url.trim() ? p.url.trim() : '')

// The project's web address: the override when there is one, otherwise made from the title.
export const addressOf = (p) => overrideOf(p) || slugify(p?.title)

// The path of a project's case study page, without slashes at either end.
export const pagePath = (category, address) => `projects/${category}/${address}`
