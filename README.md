# Zafran Zakaria portfolio

Personal portfolio of Zafran Zakaria. A static React site, built with Vite and TanStack Router and published on GitHub Pages. All words, images and settings live in plain files in `content/`, so the site can be edited without touching code.

Original build by Liana. Redesign, content model and build checks added in 2026.

## How it fits together

| Folder | What it holds |
| --- | --- |
| `content/projects/` | One Markdown file per project. The file name is the project's web address. |
| `content/categories/` | One file per project category (name, intro line, order). |
| `content/about.md` | The About page: intro, skills, education, experience. |
| `content/site.yml` | Homepage intro, Areas of Focus, CV file, contact links. |
| `public/media/` | Images used by the content. `public/files/` holds PDFs such as the CV. |
| `src/routes/` | One file per page type (home, About, Projects, category, case study). |
| `src/components/` | Header, footer, category index, project bands, gallery, opening visuals and image handling. |
| `src/lib/site.ts` | Reads the content and provides it to the pages. |
| `src/styles.css` | All styling, in one file, ordered by page. No CSS framework. |
| `content-collections.ts` | The content fields and their rules. A build fails if a file breaks them. |
| `scripts/postbuild.mjs` | Runs after every build: page files, draft removal and checks. |
| `docs/` | Frozen copy of the original live site, kept as a fallback. Not used by the build. |

### Content rules worth knowing

- **Drafts.** A project with `status: Draft` is left out of production builds completely: no page, no list entry, and any image used only by drafts is removed. Preview builds (the test site) show drafts with a "Draft" label. The repository is public, so draft files can still be read on GitHub.
- **Case-study designs.** The five original case studies set a hidden `design` field that selects their own approved opening and "The work" layout. Projects without it use the standard template.
- **Highlights.** In the homepage and About intros, text wrapped in `**double asterisks**` is shown with the light-sage highlight.
- **Missing images** show a labelled placeholder rather than breaking the layout.
- **Addresses.** Every page address ends in a slash (`/about/`), matching the folders GitHub Pages serves, and each page names its production address on zafranzakaria.com as canonical. Drafts and the 404 page name none. The build checks this on every page.
- **Search engines.** Preview builds (the test site) tell search engines not to index any page. The site is still public; this only keeps drafts and placeholder text out of search results. Production builds carry no such tag, and the build fails if either rule is broken.

## Styling

Everything is in `src/styles.css`, without a framework. The tokens at the top set the system:

- **Layout and display type** scale with the window (`--m` margins, `--d1`/`--d2` titles, `--h2`/`--h3` headings), so a page keeps its composition from a laptop to a large monitor.
- **Text** uses five sizes, `--t-meta`, `--t-small`, `--t-body`, `--t-lead` and `--t-statement`, in rem. One rem is 18px on a 1440px window and 16px on phones.
- **Spacing** between sections and before the footer comes from `--section`.

Phones (under 900px) have their own values in each section's mobile block. Each original case study keeps its own layout through its `design` field, so not every page is built from the same template.

The typeface is Instrument Sans, bundled with the site rather than loaded from Google.

## Working on it

Requires [Bun](https://bun.sh) (the version used in CI is set in `.github/workflows/deploy.yml`).

```bash
bun install
bun run dev            # local site at http://localhost:3000
bun run build          # production build into dist/, drafts excluded
bun run build:preview  # preview build, drafts shown
```

Both builds type-check the code, then finish with a report from `scripts/postbuild.mjs`. It fails the build if:

- a project points to a category or file that does not exist;
- a web address uses anything other than lowercase letters, numbers and hyphens;
- any draft content is found in a production build.

It also prints the size of the published site, the repository and the largest file against GitHub's limits. It warns above 500 MB, and for files over 20 MB or images over 1 MB.

## Deployment

Day-to-day work happens on the `dev` branch and is merged into `main` when it is ready. `live-backup-2026-11` is a recovery point and is never changed.

`.github/workflows/deploy.yml` runs on every push to `main`. It runs the production build as a check, then publishes the preview build to GitHub Pages. If a size warning appears, it opens or updates a "Website size warning" issue, which GitHub emails to the repository owner. A failed build publishes nothing, so the site stays as it was.

Every page also gets its own `index.html` at build time, so direct links and refreshes return a normal page rather than GitHub's 404.
