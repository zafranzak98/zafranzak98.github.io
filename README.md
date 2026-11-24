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
- **Films** from YouTube or Vimeo load only when the visitor presses play, so nothing is fetched from those sites before then. Once playing, the provider may collect information or store data, as the note on the film says.
- **Addresses.** Every page address ends in a slash (`/about/`), matching the folders GitHub Pages serves, and each page names its production address on zafranzakaria.com as canonical. Drafts and the 404 page name none. The build checks this on every page.
- **Search and sharing.** Each project can set its own page title, search description and sharing image (`seo`). Empty fields fall back to the title, summary and cover image. Every page gets Open Graph tags for link previews.
- **Search engines.** Preview builds (the test site) tell search engines not to index any page. The site is still public; this only keeps drafts and placeholder text out of search results. Production builds carry no such tag, and the build fails if either rule is broken.

## Website editor

Content is edited at `/admin` with [Sveltia CMS](https://sveltiacms.app), which saves straight to the `main` branch through GitHub. Each save starts a normal build and deploy.

- **Settings.** `public/admin/config.yml` lists every field in plain English. It must match `content-collections.ts`.
- **Sign-in.** "Sign in with GitHub", through the [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) on the site owner's own Cloudflare account (`sveltia-cms-auth.zafranzak98.workers.dev`, free plan). It uses a GitHub App installed on this repository only, with Contents read and write. Sign-ins last 8 hours and renew automatically: when GitHub's token expires, Sveltia sends the renewal key it keeps in the browser to the Worker, which asks GitHub for a new token (this needs the GitHub App's "Expire user authorization tokens" setting). Each renewal issues a new renewal key; after about six months without use you sign in again. Signing out removes the sign-in from the browser; it does not cancel it at GitHub. To cancel every sign-in and renewal key at once, revoke the app in GitHub Settings, Applications. The Worker only answers sign-ins from `zafranzak98.github.io` and `zafranzakaria.com` (`ALLOWED_DOMAINS`).
- **Version.** `@sveltia/cms` is pinned to an exact version in `package.json`. The build copies it into `dist/admin` from `node_modules`, and the page loads it with an integrity hash and a content security policy that blocks code from other sites.
- **Uploads.** Images are converted to WebP at quality 85 and at most 2400px wide, in every browser. Project images go to `public/media/projects/<project>/`.
- **Responsive images.** The build also publishes smaller WebP copies of every published photo, 480, 960 and 1600px wide (never wider than the original), named `photo-w960.webp` beside `photo.webp`. Each image on a page lists them with `srcset` and says how wide it is shown with `sizes`, so the browser downloads the smallest copy that stays sharp. Uploads in the repository are never changed. The rules are in `src/lib/image-variants.js`; the copies are made in `scripts/postbuild.mjs`; the widths come from a small Vite plugin in `vite.config.ts`. Only photos that published content uses are listed (`scripts/published-media.mjs`), so a draft's file names never reach the production build. A new image component needs a `sizes` value that matches how wide it is shown.
- **WebP in Safari.** Safari (and every browser on iPhone and iPad) cannot encode WebP itself; asked for it, the canvas returns PNG ([WebKit bug 226950](https://bugs.webkit.org/show_bug.cgi?id=226950)). Sveltia then fetches an encoder from unpkg.com, which the page's security policy refuses, so uploads used to be saved as large PNGs. `src/admin/webp-fallback.js` supplies the same encoder (`@jsquash/webp`, pinned in `package.json`) from `/admin/vendor/` instead, only when the browser cannot encode WebP. The policy allows `'wasm-unsafe-eval'` for it (WebAssembly compilation only, not `eval`). If the encoder fails, the browser's own result is used, as before. To check it: upload a photo in Safari and confirm the saved file ends in `.webp`.

## Design editor

A visual editor for project pages at `/admin/design/?project=<file name>`, separate from the website editor at `/admin`. It is in development on the `editor-ux` branch and is not on the live site.

- **What it does.** Click any part of a project page to change its words, size, weight, colour, alignment, position, width or visibility, per screen size (Desktop 1280px and up, Tablet 900 to 1279px, Phone below 900px). Shift-click (or "Select more" on a touchscreen) changes several parts together, and Arrange lines them up or spaces them evenly. A dot on Desktop, Tablet or Phone shows the sizes where the selected part has its own settings. Publishing saves the words to the project's content file, category names to `content/categories/`, and the layout to `content/layouts/<project>.json`, in one commit that either fully succeeds or saves nothing.
- **Images.** A selected image can be resized (side handle or a typed width), moved, cropped (crop focus), and turned: drag the round handle above it, or type an angle (Shift-drag keeps to 15° steps; it settles on level near 0°). The angle is saved per screen size as `rotate` in the layout file and drawn by the browser, so the image file is never changed. On a project cover it replaces the cover's designed tilt (set in `src/components/opening-visual.tsx`); on other images the whole part turns. Reset, Undo and Redo cover it like any other setting.
- **Sections panel.** The left panel (`sections.tsx`) replaces Puck's own Blocks and Outline panels: "On this page" lists, selects and reorders sections (drag, Alt+arrow keys, or the ⋯ menu with Duplicate, Show on and Remove); "Add a section" adds Text, Statement or Space, all built from the existing blocks in `config.tsx`. Photos are uploaded and placed in the website editor (Sveltia, `/admin`); this editor presents a photo that is already on the page (Present the photo: width per screen, shape, fit, crop focus) but does not add one. An Image section with no photo, which only an old draft can hold, blocks publishing until it is removed (`photos.tsx`). It takes Puck's "blocks" slot; the empty "outline" slot is hidden in `editor.css`, which depends on Puck's class names (Puck is pinned). If the panel stops appearing after a Puck upgrade, check those class names first.
- **Formatted words.** Words in paragraphs and captions can be partly bold, italic or underlined. On the page they are typed in a rich copy (`formatting.ts`): Bold, Italic and Underline, or Cmd/Ctrl+B, I and U, format the selected words or what is typed next. They are stored with the markers the site already reads (`src/components/rich.tsx`): `*bold*`, `_italic_`, `++underline++`, plus `**highlight**`. Titles, headings and labels stay plain words; a field takes formatting only when its page part has `rich: true` in `src/layout/`. Whole-part weight is in All settings, Look, Weight.
- **Project photos.** Photos placed in the website editor are presented here without changing the file: Size (Narrow, Text column, Wide, Full), width per screen size, Shape (As designed, Its own shape, Square, 4:5, 3:4, 16:9), Fit, Crop focus and Angle. Span, shape and fit are stored with the page's layout (`span`, `shape`, `fit` in `src/layout/elements.ts`) and drawn by `src/styles.css`; in a gallery row the shape applies to the whole row. Adding or replacing photos stays in the website editor.
- **Links in the page.** Inside the editor, a link to another page never opens (click or Enter); Enter on a link selects its part instead. Jumps within the page (#outcomes) scroll there (`elements.tsx`, `onClick`).
- **Phones.** The top bar has two rows and the tools for a selected part two more, so nothing hides off the side; Colour and alignment are in Settings on phones. These rules depend on Puck's class names for the bottom tabs (`editor.css`); Puck is pinned.
- **Undo keeps the editor's layout.** Puck stores the open panels and screen size in each Undo step; `main.tsx` puts them back after Undo and Redo so only the page changes.
- **Content only.** Publishing refuses any file outside `content/` before GitHub is asked (`github.ts`); the build guard checks the same on GitHub.
- **Choosing hidden parts.** Clicking where parts overlap shows "Also here" in the toolbar, listing the others under that point.
- **Saving.** The status beside Undo says: Same as the website, Not saved yet, Saving…, Draft saved or Published (with the time), or Not saved: see the message (when a save fails; nothing on the website changes). Undo and Redo say what they will change ("Undo: turn Opening image"), and a short message confirms it afterwards.
- **Layout notes.** After each change the editor checks the screen size being edited for parts that run off the screen, stick out of their section, are cut off, overlap or are hard to read, and shows a count in the bottom-left corner ("2 layout notes"). Notes are advice only: nothing is moved or blocked. A Desktop change shows a reminder with "Check Tablet and Phone"; other sizes are checked only when asked, and all three before publishing. "This is intended" silences one note for one part at one size; it is saved with the page (`intended` in the layout file) and can be undone from the list. The approved Sage contrast exception on AF-Binary and Evoke is never reported. A check takes about 1 ms and waits for fonts and images. Suggestions, listed separately, cover only parts moved at that size: moved a long way from the designed place (more than a fifth of the page across, or more than its own height and 120px down), text just missing the edge or centre of the text around it (4 to 24px), and spacing well away from its designed size that matches none of the section's own spacings. A suggestion can offer a fix ("Move it back", "Line it up", "Match the spacing"), applied only when chosen and undone like any change. With too little to compare with, nothing is suggested.
- **Files.** `src/editor/` holds the editor: `main.tsx` (top bar, saving, sign-in), `elements.tsx` (selecting, moving and typing on the page), `panel.tsx` (contextual bar and settings panel), `checks.ts` and `notes.tsx` (layout notes and suggestions), `history.ts` (what Undo and Redo will change), `github.ts` (reading and saving through GitHub), `signin.ts` (the shared sign-in), `config.tsx` (the page sections it offers). The website draws saved layouts with `src/layout/` and never loads the editor's code, so visitors download nothing extra.
- **Sign-in.** It uses the website editor's sign-in in the same browser (`signin.ts`): it reads only the access token Sveltia stores, never the renewal key, and changes nothing there except removing it on Sign out. If that sign-in is missing, expired or in an unexpected format, the editor offers its own "Sign in", kept only until the tab closes. Sign out signs out of both editors in this browser (reload /admin if it is open in another tab); it does not cancel the sign-in at GitHub, which is done by revoking the app in GitHub, Settings, Applications.
- **How it fails, and what you would see.** If layout notes stop appearing, the page still edits and publishes normally, and the check before publishing still lists problems; look for errors from `notes.tsx` in the console. A save that clashes with a change made elsewhere is refused with a message and nothing is saved. An expired sign-in shows a message and the Sign in button. A failed build after publishing leaves the website as it was, as for any save.
- **Check first.** The browser console on `/admin/design/` for errors; the newest run under Actions after a publish; whether the same change works in `/admin`.
- **Restore.** Every published version is listed under More, Versions in the editor. Deleting a page's `content/layouts/<project>.json` returns that page to its standard design. The editor can be removed from the site without affecting pages, which keep rendering from their layout files.
- **Tests.** `tests/editor/` (see its README).

## Styling

Everything is in `src/styles.css`, without a framework. The tokens at the top set the system:

- **Colour** is the five approved colours only: Off-white `#EEF1ED`, Olive `#484527`, Sage `#A3B18A`, Light Sage `#CDD5BE` and Terracotta `#9A3F24`. No other colours, tints, transparency, gradients or shadows. A project's Opening colour is its preferred colour. `src/lib/project-colours.js` gives every project one final colour, used for its band and its case study opening, keeping the preference unless it would sit next to the same or a too-similar colour on the All page or its category page (Off-white/Light Sage, Sage/Light Sage, Olive/Terracotta). Small text on a Sage band or opening sits on the Light Sage highlight, because olive on Sage alone is below the WCAG AA contrast ratio for small text. The project that is last on any Projects page (All or a category) is never Olive, because it sits directly above the Olive footer; Olive projects elsewhere keep their colour. The build runs the same check and fails with a plain message if no arrangement works. Text colours per background are set in `OPENING` in `src/lib/site.ts`.
- **Project titles** on the Projects pages are all one size (`--d1`); long titles wrap clear of the project visual and the band grows to fit.
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

Code changes are made on a branch and reach `main` only through a pull request that the site owner merges. Editor saves go straight to `main`. `live-backup-2026-11` is a recovery point and is never changed.

`.github/workflows/deploy.yml` runs on every push to `main`. A guard job first compares `main` with the version last published: content changes and merged pull requests go ahead, anything else stops before the build (a manual run can publish it only if its "Publish code without a pull request" box is ticked). If the last published version cannot be confirmed, nothing is published. The build job then runs the production build as a check and publishes the preview build to GitHub Pages. If a size warning appears, it opens or updates a "Website size warning" issue, which GitHub emails to the repository owner. A failed build publishes nothing, so the site stays as it was.

Every page also gets its own `index.html` at build time, so direct links and refreshes return a normal page rather than GitHub's 404.

## Quality targets

Checked before launch and on every significant change, and reported with the results. The local baseline (23 Nov 2026) was measured on a copy of the published version (commit `2a989a1`) served from a local computer, not on the public site; the workspace used could not reach the site. Published-site figures come from PageSpeed Insights and are listed separately below. Neither is real-visitor data.

| Area | Target | Baseline (local) |
|---|---|---|
| Page weight, compressed, whole page scrolled, phone width | 500 KB or less per page | 162 to 462 KB (Cancel Me, Not! 462) |
| Page weight, desktop width, image-led case studies | 1 MB or less | Cancel Me, Not! 884 KB; others under 450 KB |
| Script, compressed | 120 KB or less | 97 to 106 KB |
| Loading, Lighthouse mobile (simulated mid-range phone, slow 4G) | Largest Contentful Paint 2.5 s or less (Google's "good" threshold) | 1.9 to 3.5 s: Projects 2.4 to 3.0, Cancel Me, Not! 3.3 to 3.5 over target |
| Responsiveness: Total Blocking Time, a lab stand-in for INP (not INP itself) | 200 ms or less (Lighthouse's "good" threshold) | 0 to 81 ms |
| Visual stability | Cumulative Layout Shift 0.1 or less (Google's "good" threshold) | 0.13 to 0.18 on Projects, AF-Binary and Cancel Me, Not!: over target |
| Accessibility | WCAG 2.2 AA: no automated failures, plus the manual checks below | Automated: passes except the approved AF-Binary and Evoke small text on Sage (4.27:1, below AA's 4.5:1). Manual checks: not yet done |
| Editor code | No design-editor files downloaded by any visitor page | None, on `main` and on the editor branch |

Largest Contentful Paint and Cumulative Layout Shift use Google's "good" Core Web Vitals thresholds (web.dev/articles/vitals), which Google applies to real visits at the 75th percentile; here they are applied to lab measurements. The third Core Web Vital, Interaction to Next Paint (INP, good at 200 ms or less), needs real interactions and cannot be measured by Lighthouse, so Total Blocking Time stands in for it in the lab. The page-weight and script limits are this project's own, chosen from the baseline with room for new work.

**Published test site (PageSpeed Insights, Lighthouse 13.6, one run each, 23 Nov 2026). Lab measurements, not real-visitor data: PageSpeed shows "No Data" for real users so far.**

| Page (time captured) | Form | Performance | LCP | TBT | CLS | Accessibility |
|---|---|---|---|---|---|---|
| Home (12:05) | Mobile | 95 | 1.2 s | 0 ms | 0.107 (over 0.1) | 100 |
| Home (12:05) | Desktop | 99 | 0.2 s | 0 ms | 0.061 | 100 |
| Projects (12:29, timing uncertain: the loading fixes went live at 12:28) | Mobile | 91 | 2.0 s | 0 ms | 0.15 | not recorded |
| Cancel Me, Not! (12:29, timing uncertain) | Mobile | 98 | 2.0 s | 0 ms | 0 | not recorded |
| Projects (12:34, after the loading fixes) | Mobile | 99 | 2.0 s | 0 ms | 0.00 | 95 |

SEO scores 66 on the test site because it deliberately asks search engines not to index it until launch. One run each, so a single figure can vary; the Projects result after the fixes is one run, not yet a consistent pattern. Cancel Me, Not! is still to be measured after the fixes.

**Accessibility exception.** AF-Binary and Evoke deliberately show small text directly on Sage at 4.27:1 (approved 22 Nov 2026), below WCAG 2.2 AA's 4.5:1 for small text. While it stands, the site does not fully meet WCAG 2.2 AA.

**How to measure**

- *Weight and editor files:* load each representative page (Home, Projects, About, a category page, AF-Binary, Cancel Me, Not!) at 390 and 1440 px, scroll to the end, and total the compressed downloads by type; list any file whose name contains `design-`, `Editor-` or `/admin`.
- *Loading:* Lighthouse 12, mobile, default simulated throttling, two runs per page, both reported. Local results come from a computer, not a visitor's phone.
- *Real test site:* pagespeed.web.dev, Mobile, for the same pages. Real-visitor data appears there and in Search Console only once there are enough visits.
- *Accessibility, automated:* axe-core (WCAG 2 A and AA rules) at 390, 900 and 1440 px, plus Lighthouse's accessibility audit.
- *Accessibility, manual:* keyboard only (every link and control reachable, focus visible, nothing trapped); a screen-reader pass with VoiceOver on Mac and iPhone; text zoomed to 200% and a 320 px wide window without sideways scrolling; reduced-motion setting respected; link and image descriptions make sense out of context. An automated pass is not proof of compliance.

## Recovery

If the website breaks, the last good version can always be brought back without changing any code.

- **Known-good versions** are listed under Releases on the repository page, each named "Known good" with its date and what was checked. Only versions that passed the checks are labelled.
- **A failed build never changes the website.** The previous version stays up.
- **`live-backup-2026-11`** is the recovery point for the original site. Never delete or change it.

| Problem | What to do |
|---|---|
| An editor save does not appear after a minute, or a "Run failed" email | Repository, Actions, newest "Build and deploy" run. The summary lists lines starting ERROR, each naming the problem (for example an image file that does not exist). Fix that field in the editor and save again. |
| A run says "Not published" | Code reached `main` without a pull request. If it was meant, open a pull request for it, or run the workflow by hand and tick "Publish code without a pull request". If not, change nothing. |
| A published edit is wrong | Change it back in the editor. Earlier wording: open the file in `content` on GitHub, choose History, and copy from the earlier version. |
| A merged pull request broke something | On that pull request's page choose Revert, then merge the pull request it opens. |
| The site is down or blank | Check githubstatus.com. If GitHub is fine: Releases, note the commit of the latest "Known good" version; Actions, find the successful run for that commit and choose "Re-run all jobs". Check the site afterwards. |
| Sign-in fails at /admin | Try a private window. Check the GitHub App is still installed on this repository (GitHub Settings, Applications) and the Worker `sveltia-cms-auth` still exists in Cloudflare. Do not create new keys or change secrets. |
| Anything else | Do not delete branches or force anything. |

**When asking a developer for help, send:** the link to the failed run or pull request, the ERROR lines or a screenshot of the problem, the page address, what changed just before (an editor save, a merged pull request), and the latest "Known good" release.

## Project web addresses

- A project's **file name** in `content/projects` is its permanent internal ID. Images, colours and the editor use it, and it never changes.
- Its **web address** (the last part of its page URL) is the editor's **Web address** field when filled in, otherwise it is made from the current title (`src/lib/project-urls.js`). Renaming a project changes its address; filling in Web address fixes it; emptying the field returns to the title.
- **Old addresses keep working.** Each build reads the save history (`scripts/redirects.mjs`) and writes a small redirect page at every address a project has had, including old categories, pointing straight to the current address. The full list is published at `/redirects.json`. The build stops if the history is incomplete (a shallow copy), if two projects would share an address, or if an override is not lowercase letters, numbers and single hyphens.
- **Limitations of redirects on GitHub Pages.** GitHub Pages cannot send real HTTP 301 redirects. The redirect pages use an instant meta refresh, a script, a canonical link to the new address and a plain link. Browsers follow them at once; search engines treat an instant refresh much like a permanent redirect, but more slowly and with less certainty than a 301, and the old address can stay in search results for a while. Since every page names zafranzakaria.com as canonical, this matters only after launch. Deleting a project removes its page; its old addresses then stop working, as before.
