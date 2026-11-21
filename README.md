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
| `src/components/` | Header, footer, project rows, gallery and image handling. |
| `src/lib/site.ts` | Reads the content and provides it to the pages. |
| `content-collections.ts` | The content fields and their rules. A build fails if a file breaks them. |
| `scripts/postbuild.mjs` | Runs after every build: page files, draft removal and checks. |
| `docs/` | Frozen copy of the original live site, kept as a fallback. Not used by the build. |

### Content rules worth knowing

- **Drafts.** A project with `status: Draft` is left out of production builds completely: no page, no list entry, and any image used only by drafts is removed. Preview builds (the test site) show drafts with a "Draft" label. The repository is public, so draft files can still be read on GitHub.
- **Case-study designs.** The five original case studies set a hidden `design` field that selects their own approved opening and "The work" layout. Projects without it use the standard template.
- **Highlights.** In the homepage and About intros, text wrapped in `**double asterisks**` is shown with the light-sage highlight.
- **Missing images** show a labelled placeholder rather than breaking the layout.

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

`.github/workflows/deploy.yml` runs on every push to `main`. It runs the production build as a check, then publishes the preview build to GitHub Pages. If a size warning appears, it opens or updates a "Website size warning" issue, which GitHub emails to the repository owner. A failed build publishes nothing, so the site stays as it was.

Every page also gets its own `index.html` at build time, so direct links and refreshes return a normal page rather than GitHub's 404.
