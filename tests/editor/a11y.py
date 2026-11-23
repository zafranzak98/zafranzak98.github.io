# Accessibility of the editor's own controls (not the website pages it shows): an automated axe check
# of the editor with the Sections panel, the side panel and a selection open, and keyboard-only use of
# the Sections panel. Needs axe-core, installed without changing the project's dependencies:
#   npm i --no-save axe-core     (or set AXE to the path of axe.min.js)
# Run from the repository root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import json, os
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""))
AXE = os.environ.get("AXE") or next(p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p))
URL = "http://localhost:4302/admin/design/?project=about-face-beauty"
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]

def axe(pg, label):
    pg.add_script_tag(path=AXE)
    out = pg.evaluate("""async () => {
      const r = await axe.run({ exclude: [['#preview-frame']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })
      return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, where: v.nodes.slice(0, 3).map(n => n.target.join(' ')) }))
    }""")
    serious = [v for v in out if v["impact"] in ("serious", "critical")]
    check(f"axe, {label}: no serious or critical problems", not serious, json.dumps(serious)[:600])
    minor = [v for v in out if v["impact"] not in ("serious", "critical")]
    if minor: print(f"  note, {label}: minor findings {json.dumps(minor)[:400]}")
    return out

with sync_playwright() as p:
    br = p.chromium.launch()
    # bypass_csp lets the test inject axe; it affects this test browser only, never the editor or the site.
    pg = br.new_page(viewport={"width": 1440, "height": 900}, bypass_csp=True); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)

    # 1. Keyboard only: reach Sections from the top of the page, open it, go to a section, reorder, add.
    pg.keyboard.press("Tab")
    found = False
    for _ in range(40):
        if pg.evaluate("document.activeElement.innerText.trim()") == "Sections": found = True; break
        pg.keyboard.press("Tab")
    check("The Sections rail button can be reached with Tab", found)
    check("It is announced as a button, with its state", pg.evaluate("document.activeElement.getAttribute('role')") == "button" and pg.evaluate("document.activeElement.getAttribute('aria-pressed')") in ("true", "false"))
    if pg.evaluate("document.activeElement.getAttribute('aria-pressed')") == "false" or not pg.locator(".sec-panel:visible").count():
        pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
    check("Enter opens the Sections panel", pg.locator(".sec-panel:visible").count() == 1)
    rows = 0
    for _ in range(30):
        pg.keyboard.press("Tab")
        if pg.evaluate("document.activeElement.className") == "sec-go":
            rows += 1
            if pg.evaluate("document.activeElement.querySelector('.sec-name').innerText") == "Outcomes": break
    check("Tab reaches the section rows, one by one", rows == 9, str(rows))
    pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
    check("Enter on a row selects that section", pg.locator(".editor-bar-ctx").inner_text().startswith("Outcomes"))
    pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Outcomes")).locator(".sec-go").focus()
    pg.keyboard.press("Alt+ArrowUp"); pg.wait_for_timeout(500)
    names = pg.locator(".sec-row .sec-name").all_inner_texts()
    check("Alt+Up moves it with the keyboard alone", names.index("Outcomes") == 7, str(names))
    pg.keyboard.press("Tab"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    check("The row's ⋯ menu opens from the keyboard and focus moves into it", pg.locator(".sec-menu").count() == 1 and pg.evaluate("!!document.activeElement.closest('.sec-menu')"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Escape closes it and returns to ⋯", pg.locator(".sec-menu").count() == 0 and pg.evaluate("document.activeElement.className") == "sec-more")
    pg.get_by_role("tab", name="Add a section").focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    for _ in range(12):
        pg.keyboard.press("Tab")
        if "sec-option" in pg.evaluate("document.activeElement.className"): break
    check("Tab reaches the first kind to add", "Text" in pg.evaluate("document.activeElement.innerText"))
    pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
    check("Enter adds it and says so", "Text added below" in pg.locator(".sec-panel [role=status]").inner_text())
    check("Ctrl or Cmd+Z undoes the addition", (pg.keyboard.press("ControlOrMeta+z"), pg.wait_for_timeout(700))[1] is None and not any("Text" in n for n in pg.locator(".sec-row .sec-name").all_inner_texts()))
    check("Focus is visible on the section controls", pg.evaluate("""() => { const b = document.querySelector('.sec-go'); b.focus(); const s = getComputedStyle(b); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 }"""))

    # 2. Automated checks with the panels in their everyday states.
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    if not pg.locator(".sec-panel:visible").count(): pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(600)
    axe(pg, "Sections, On this page")
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    axe(pg, "Sections, Add a section")
    f = frame(pg); el = f.locator(".cs-open-visual").first; b = el.bounding_box()
    pg.mouse.click(b["x"] + 10, b["y"] + 10); pg.wait_for_timeout(500)
    pg.get_by_role("button", name="More settings").first.click(); pg.wait_for_timeout(500)
    axe(pg, "image selected with its settings")

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
