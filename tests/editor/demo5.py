# Round 5 (Demo 5), items 4 and 7: the contextual bar keeps at most six labelled primary controls for
# each kind of selection, with the rest in a labelled More menu that works by keyboard; every moved
# action still works from there; text sizes are named as sizes, never like a part or section; "Save
# draft" reads the same at every width. Items 5 and 6: the Tablet and Phone strip; the side panel's
# breadcrumb, Layout group and Fine-tune. The selection's name, Also here and Done are not counted.
# Run from the repository root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import json, os, re
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = os.environ.get("EDITOR_URL", "http://localhost:4302/admin/design/?project=about-face-beauty")
AXE = os.environ.get("AXE") or next(p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p))
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def fresh(br, w=1440, h=900):
    pg = br.new_page(viewport={"width": w, "height": h}, bypass_csp=True); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    return pg, errs
def tap(pg, sel, shift=False):
    el = frame(pg).locator(sel).first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); b = el.bounding_box()
    if shift: pg.keyboard.down("Shift")
    pg.mouse.click(b["x"] + 6, b["y"] + b["height"] / 2)
    if shift: pg.keyboard.up("Shift")
    pg.wait_for_timeout(700)

# The primary controls in the bar: each labelled group counts once; loose buttons count one each.
PRIMARY = """() => { const bar = document.querySelector('.editor-bar-ctx .ctx'); const out = []
  const skip = (e) => e.matches('.ctx-name, .ctx-gap, .ctx-live, .ctx-where, .sr-only, .ctx-more-wrap, .ctx-more-sel, [aria-label^="Done"]') || e.querySelector('.ctx-also')
  for (const e of bar.children) {
    if (skip(e) || !e.getClientRects().length) continue
    if (e.matches('button, input, select') || e.getAttribute('aria-label') || e.matches('.ctx-arrange')) out.push(e.getAttribute('aria-label') || e.innerText.trim())
    else e.querySelectorAll('button').forEach((b) => out.push(b.getAttribute('aria-label') || b.innerText.trim()))
  }
  return out }"""
def primary(pg): return pg.evaluate(PRIMARY)
def open_more(pg):
    pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(300)
    return [t.strip() for t in pg.locator(".ctx-more-menu > button, .ctx-more-menu .ctx-menu-label").all_inner_texts()]
def axe(pg):
    pg.add_script_tag(path=AXE)
    return pg.evaluate("""async () => (await axe.run({ exclude: [['#preview-frame']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
      .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, where: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }))""")

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []
    for w, h in [(1440, 900), (390, 844)]:
        pg, e = fresh(br, w, h); errors += e
        if w < 638 and pg.locator(".sec-panel:visible").count(): pg.keyboard.press("Escape"); pg.wait_for_timeout(300)

        # A text part.
        tap(pg, "[data-el='line']")
        c = primary(pg)
        check(f"{w}px, text part: at most six primary controls, each named", 0 < len(c) <= 6 and all(c), str(c))
        items = open_more(pg)
        check(f"{w}px, text part: More holds Box position, Hide, Select more and Reset, in words", any("Box position" in t for t in items) and any(t.startswith("Hide on") for t in items) and "Select more parts" in items and any(t.startswith("Reset") for t in items), str(items))
        check(f"{w}px: the menu takes focus", pg.evaluate("!!document.activeElement.closest('.ctx-more-menu')"))
        bad = axe(pg)
        check(f"{w}px: axe finds no serious or critical problems with More open", not bad, json.dumps(bad)[:300])
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        check(f"{w}px: Escape closes More, returns focus to it, and keeps the selection", pg.locator(".ctx-more-menu").count() == 0 and pg.evaluate("document.activeElement.classList.contains('ctx-more')") and pg.locator(".ctx-name").first.inner_text() == "Summary line")
        pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
        check(f"{w}px: Enter opens it again from the keyboard", pg.locator(".ctx-more-menu").count() == 1)
        pg.locator(".ctx-more-menu button", has_text="Select more parts").click(); pg.wait_for_timeout(300)
        check(f"{w}px: Select more, while on, shows in the bar so it can be turned off", pg.locator(".ctx .ctx-more-sel").count() == 1)
        pg.locator(".ctx .ctx-more-sel").click(); pg.wait_for_timeout(300)
        check(f"{w}px: …and turns off from there", pg.locator(".ctx .ctx-more-sel").count() == 0)

        # Text sizes are named as sizes.
        # On phones Size is in the Text sheet (the Aa button), from Demo 5.2.
        if w < 638: pg.locator(".ctx .ctx-aa").click(); pg.wait_for_timeout(400)
        at = ".ctx-sheet" if w < 638 else ".ctx"
        names = set()
        for _ in range(10):
            names.add(pg.locator(f"{at} .ctx-stepper output").first.inner_text()); pg.locator(f"{at} button[aria-label='Larger text']").click(); pg.wait_for_timeout(150)
        for _ in range(10):
            pg.locator(f"{at} button[aria-label='Smaller text']").click(); pg.wait_for_timeout(150); names.add(pg.locator(f"{at} .ctx-stepper output").first.inner_text())
        if w < 638: pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        clash = names & {"Title", "Heading", "Label", "Statement", "Caption", "Note"}
        check(f"{w}px: text sizes never share a name with a part or a section style", len(names) == 9 and not clash, str(sorted(names)))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)

        # An image part.
        tap(pg, ".cs-open-visual")
        c = primary(pg)
        check(f"{w}px, image: at most six primary controls, each named", 0 < len(c) <= 6 and all(c), str(c))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)

        # Several parts.
        tap(pg, "#outcomes [data-el='skills-label']"); tap(pg, "#outcomes [data-el='skills']", shift=True)
        c = primary(pg)
        check(f"{w}px, several parts: at most six primary controls, each named", 0 < len(c) <= 6 and all(c), str(c))
        items = open_more(pg)
        check(f"{w}px, several parts: More holds Hide all, Select more and Reset", any(t.startswith("Hide all") for t in items) and "Select more parts" in items and any(t.startswith("Reset") for t in items), str(items))
        pg.keyboard.press("Escape"); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)

        # A section: Duplicate and Remove are in More and still work.
        if not pg.get_by_role("tab", name="On this page").count(): pg.get_by_role("button", name="Sections").first.click(); pg.wait_for_timeout(500)
        pg.get_by_role("tab", name="On this page").click(); pg.wait_for_timeout(300)
        pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Outcomes")).locator(".sec-go").click(); pg.wait_for_timeout(800)
        if w < 638 and pg.locator(".sec-panel:visible").count(): pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        c = primary(pg)
        check(f"{w}px, section: at most six primary controls, each named", 0 < len(c) <= 6 and all(c), str(c))
        before = frame(pg).locator("[data-puck-component]").count()
        items = open_more(pg)
        check(f"{w}px, section: More holds Duplicate section and Remove section", "Duplicate section" in items and "Remove section" in items, str(items))
        pg.locator(".ctx-more-menu button", has_text="Duplicate section").click(); pg.wait_for_timeout(800)
        check(f"{w}px: Duplicate section from More adds one section", frame(pg).locator("[data-puck-component]").count() == before + 1)
        pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(700)
        check(f"{w}px: Undo takes the copy away", frame(pg).locator("[data-puck-component]").count() == before)

        check(f"{w}px: the save button reads Save draft", pg.locator(".editor-save").inner_text().strip() == "Save draft")
        pg.close()


    # Item 5: a steady strip while editing Tablet or Phone; none on Desktop.
    pg, e = fresh(br); errors += e
    def strip(): return pg.locator(".editor-strip").all_inner_texts()
    check("Desktop: no strip", strip() == [])
    pg.get_by_role("button", name=re.compile("^Tablet")).first.click(); pg.wait_for_timeout(1200)
    check("Tablet: the strip says where changes apply", strip() and strip()[0].startswith("Editing Tablet. Changes here apply to tablets, and to phones unless Phone has its own setting."), str(strip()))
    pg.get_by_role("button", name=re.compile("^Phone")).first.click(); pg.wait_for_timeout(1200)
    check("Phone: the strip says phones only, and explains the dot", strip() and "apply to phones only" in strip()[0] and "dot" in strip()[0], str(strip()))
    s_box = pg.locator(".editor-strip").bounding_box(); c_box = pg.locator("#preview-frame").bounding_box()
    check("The strip sits above the page and covers none of it", s_box["y"] + s_box["height"] <= c_box["y"] + 1, f"{s_box} {c_box}")
    tap(pg, "[data-el='line']")
    check("The strip stays while a part is selected; the bar no longer repeats it", pg.locator(".editor-strip").count() == 1 and pg.locator(".ctx-where").count() == 0)
    bad = axe(pg)
    check("Phone with the strip: axe finds no serious or critical problems", not bad, json.dumps(bad)[:300])
    pg.get_by_role("button", name=re.compile("^Desktop")).first.click(); pg.wait_for_timeout(1200)
    check("Back on Desktop the strip goes", strip() == [])

    # Item 6: breadcrumb, Layout group, Fine-tune folded away; Puck's own title hidden.
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    tap(pg, "[data-el='line']")
    pg.get_by_role("button", name=re.compile("^(All )?[Ss]ettings$")).first.click(); pg.wait_for_timeout(700)
    crumbs = pg.locator(".el-crumbs:visible").first.inner_text().replace("\n", " ")
    check("The panel starts with Page › Opening › Summary line", re.sub(r"\s+", " ", crumbs) == "Page › Opening › Summary line", crumbs)
    check("Puck's own panel title is hidden", pg.locator("[class*='_FieldsPlugin-header']:visible").count() == 0)
    groups = pg.locator(".el-panel:visible section.el-group > h3").all_inner_texts()
    check("Groups by intent: Content, Look, Layout, then Fine-tune", [g.upper().split(" ·")[0] for g in groups][:3] == ["CONTENT", "LOOK", "LAYOUT"] and pg.locator("details.el-fine:visible").count() == 1, str(groups))
    layout = pg.locator("section.el-group[aria-label='Layout']:visible")
    check("Layout holds Box position, spacing and Hide", all(layout.get_by_text(t).count() for t in ["Box position", "Space above", "Space below", "Hide on Desktop"]))
    fine = pg.locator("details.el-fine:visible")
    check("Fine-tune is closed by default", fine.count() == 1 and not fine.evaluate("d => d.open"))
    fine.locator("summary").click(); pg.wait_for_timeout(300)
    inp = fine.get_by_role("textbox", name="Across"); inp.fill("16"); inp.press("Enter"); pg.wait_for_timeout(500)
    check("Fine-tune says when an exact position is set here", "(set on Desktop)" in fine.locator("summary").inner_text())
    bad = axe(pg)
    check("Panel open: axe finds no serious or critical problems", not bad, json.dumps(bad)[:300])
    pg.locator(".el-crumbs:visible button", has_text="Opening").click(); pg.wait_for_timeout(700)
    check("The breadcrumb's section selects the whole section", pg.locator(".ctx-name").first.inner_text() == "Opening" and pg.locator(".el-crumbs:visible [aria-current]").first.inner_text() == "Opening")
    pg.locator(".el-crumbs:visible button", has_text="Page").click(); pg.wait_for_timeout(700)
    check("…and Page clears the selection", pg.locator(".ctx-hint").count() == 1)
    pg.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
