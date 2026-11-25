# Design editor tests

Browser tests for the design editor at `/admin/design/`. They prove the editor works before a pull request; the website itself does not use them.

## Running them

Needs Python 3 with Playwright (`pip install playwright`, then `playwright install chromium`). The accessibility checks in `full_suite.py` and `a11y.py` also need axe-core: `npm install --prefix /tmp/axe axe-core`, or set `AXE` to the path of `axe.min.js`.

```bash
bun run build:preview                          # builds dist/, including the editor
python3 tests/editor/serve.py dist 4302 &      # serves it at http://localhost:4302
python3 tests/editor/full_suite.py             # each file prints PASS/FAIL lines and "N of N passed"
```

On `localhost` the editor runs as a demo, so nothing reaches GitHub. `signin.py` is the exception: it opens the editor under the real site name (mapped to localhost by the browser) and answers every GitHub request itself, so no real sign-in or save is used.

## What each file proves

| File | Proves |
|---|---|
| `full_suite.py` | The whole workflow, safety checks, moving, keyboard and screen-reader use, consistency, at five screen widths |
| `tasks.py` | The 12 everyday tasks can each be done in a few steps |
| `phase1.py` | Cover sizes per screen size; category names edited on the page and saved together with the layout |
| `place.py` | Box position (left, centre, right) per screen size, separate from text alignment, with undo |
| `hide.py` | Hiding a part on one screen size only, and showing it again |
| `multi.py` | Multi-selection: Shift-click or "Select more", outlines, moving together, shared settings as one undo step, removing a member, at Desktop, Tablet and Phone |
| `align.py` | Arrange for a group: align edges, centres and middles, and space evenly, each one undo step, at Desktop, Tablet and Phone |
| `notes.py` | Layout notes: no notes on unchanged pages at three sizes, the approved contrast exception stays quiet, notes for parts moved off the page, nothing moved back, under 30 ms, keyboard use, "This is intended" saved and reversible, Tablet and Phone checked only on request, no checks while typing, the page never shifts |
| `ux.py` | Interface refinements: More menu closes with Escape or a click elsewhere, one name for the Sections panel (Puck's Outline and Blocks never shown), per-size dots, Escape from the toolbar, scroll arrows for tools on narrow screens |
| `round2.py` | Rotation by mouse, Shift, typing, arrow keys and touch, per screen size, with undo, redo and reset; suggestions with their fixes and "This is intended"; Also here; typed position; save status including a failed save; Undo and Redo labels |
| `save.py` | Saving and recovery with a pretend GitHub: slow saves, repeated clicks, lost connection, server errors, offline, reload straight after a change, Discard and Undo, closing the tab, publish refused or confirmed, two tabs, standard layout and Undo, repeated saves, Discard and Undo twice and across reloads, the tab closed or hidden 30 ms after a change |
| `workflows.py` | Complete workflows on real pages: turn, resize and move a cover then undo and redo all of it, save and reload; width, angle and crop on one image with one Reset and its Undo; hiding on Phone only; the rotate handle near the page top; suggestions showing their reference before applying |
| `sections.py` | Round 4 Sections panel: plain names in page order, choosing a section goes to it, reordering by drag, menu and Alt+arrow keys, Duplicate, Show on, Remove, each kind to add and where it goes, putting back a removed section, Undo and Redo naming each step, at 1440, 1024, 768, 390 and 375 px |
| `a11y.py` | Keyboard-only use of the Sections panel, and an axe check of the editor's own controls in three everyday states |
| `everyday.py` | Your everyday tasks start to finish in one session (find, reorder, add, edit words, move and resize an image, screen sizes, Undo and Redo, save and reload), then the editor at 1920, 1440, 1280, 1024, 768, 390 and 375 px |
| `signin.py` | The sign-in shared with the website editor: renewal in another tab, expiry, missing or unexpected data, fallback to the editor's own sign-in, sign-out from either editor |
| `final.py` | Final refinements: links in the page, settings never cut off at 768 to 1920 px, Present the photo for project photos (size, shape, fit, crop, per screen, gallery rows), section names, phone layout at 320, 390, 430 and 844×390, and Bold/Italic/Underline on selected words with shortcuts, saving, Undo and Redo |
| `photos.py` | Photos are added in the website editor, not here: Add a section offers Text, Statement and Space; no picker or Choose/Replace photo button; an old draft's empty Image section says to remove it, can be saved as a draft, blocks publishing until removed |
| `present.py` | Present the photo: widths per screen, presets, shape, fit, crop focus, the soft-photo note, Reset, Undo and Redo, phones, keyboard and axe |
| `uve.py` | Visual editor demo: every page type and shared part (Homepage, About, Projects, categories, Header, Footer, a case study with the shared parts) edited on the page, previewed, recovered after a reload, saved and published (simulated) at 1440, 1024 and 390 px (`UVE_SIZES` to choose); the shared header on other pages once published; words inside About rows, focus labels and footer links; homepage clock settings (show, city, validated time zone, line); About portrait (photo from the site, description required, width per screen size, crop focus; tilt and paperclip kept); the same words changed in another tab or by someone else (simulated); publishing blocked with reasons; axe; and the network: only GET requests to the local copy, nothing to GitHub or /admin |
| `webkit.py` | The main tasks in WebKit (WebKitGTK, not Safari): `xvfb-run -a python3 tests/editor/webkit.py` |

`seed.py` is a helper, not a test: it puts a photo section into the unsaved draft before the page loads, because photos cannot be added in this editor.

A failure names the check and what it found. Fix the cause, rebuild, and run the file again; then run the others, because a fix in one part of the editor can affect another.
