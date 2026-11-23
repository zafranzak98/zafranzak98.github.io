# Design editor tests

Browser tests for the design editor at `/admin/design/`. They prove the editor works before a pull request; the website itself does not use them.

## Running them

Needs Python 3 with Playwright (`pip install playwright`, then `playwright install chromium`). The accessibility checks in `full_suite.py` also need axe-core: `npm install --prefix /tmp/axe axe-core`, or set `AXE` to the path of `axe.min.js`.

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
| `ux.py` | Interface refinements: More menu closes with Escape or a click elsewhere, one name for the Page navigator, per-size dots, Escape from the toolbar, scroll arrows for tools on narrow screens |
| `round2.py` | Rotation by mouse, Shift, typing, arrow keys and touch, per screen size, with undo, redo and reset; suggestions with their fixes and "This is intended"; Also here; typed position; save status including a failed save; Undo and Redo labels |
| `save.py` | Saving and recovery with a pretend GitHub: slow saves, repeated clicks, lost connection, server errors, offline, reload straight after a change, Discard and Undo, closing the tab, publish refused or confirmed, two tabs, standard layout and Undo |
| `signin.py` | The sign-in shared with the website editor: renewal in another tab, expiry, missing or unexpected data, fallback to the editor's own sign-in, sign-out from either editor |

A failure names the check and what it found. Fix the cause, rebuild, and run the file again; then run the others, because a fix in one part of the editor can affect another.
