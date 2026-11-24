# Round 5, item 8: each section's parts are listed under it in Sections (the Parts list moved there
# from the side panel). Opening a section's parts, choosing one by mouse, keyboard or touch, the
# selected part marked and its section opened when a part is clicked on the page, names that tell
# two Images apart, the side panel pointing to Sections, phones, and axe.
# Run from the repository root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import json, os, re
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = os.environ.get("EDITOR_URL", "http://localhost:4302/admin/design/?project=about-face-beauty")
AXE = os.environ.get("AXE") or next(p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p))
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def fresh(br, w=1440, h=900, touch=False):
    ctx = br.new_context(viewport={"width": w, "height": h}, bypass_csp=True, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    return pg, errs
def sections(pg):
    if not pg.get_by_role("tab", name="On this page").count() or not pg.get_by_role("tab", name="On this page").is_visible():
        pg.get_by_role("button", name="Sections").first.click(); pg.wait_for_timeout(500)
    pg.get_by_role("tab", name="On this page").click(); pg.wait_for_timeout(300)
def row(pg, name): return pg.locator(".sec-row", has=pg.locator(".sec-name", has_text=name)).first
def tap(pg, sel):
    el = frame(pg).locator(sel).first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); b = el.bounding_box()
    pg.mouse.click(b["x"] + 6, b["y"] + b["height"] / 2); pg.wait_for_timeout(700)
def axe(pg):
    pg.add_script_tag(path=AXE)
    return pg.evaluate("""async () => (await axe.run({ exclude: [['#preview-frame']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
      .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, where: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }))""")

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []

    # 1. Desktop, mouse.
    pg, e = fresh(br); errors += e
    sections(pg)
    t = row(pg, "Opening").locator(".sec-toggle")
    check("Each section with parts has an arrow, closed at first", t.count() == 1 and t.get_attribute("aria-expanded") == "false" and t.get_attribute("aria-label") == "Parts of Opening")
    t.click(); pg.wait_for_timeout(400)
    names = row(pg, "Opening").locator(".sec-parts button").all_inner_texts()
    check("Opening its parts lists them in page order, with the bar's names", t.get_attribute("aria-expanded") == "true" and names[:3] == ["Title", "Category and year line", "Summary line"] or "Title" in names, str(names))
    check("The list is labelled and linked to its arrow", row(pg, "Opening").locator(".sec-parts").get_attribute("aria-label") == "Parts of Opening" and row(pg, "Opening").locator(".sec-parts").get_attribute("id") == t.get_attribute("aria-controls"))
    row(pg, "Opening").locator(".sec-parts button", has_text="Summary line").click(); pg.wait_for_timeout(800)
    check("Choosing a part selects it, the same as clicking it on the page", pg.locator(".ctx-name").first.inner_text() == "Summary line")
    check("The chosen part is marked as current in the list", row(pg, "Opening").locator(".sec-parts button[aria-current='true']").inner_text() == "Summary line")
    pg.locator(".ctx button[aria-label='Larger text']").click(); pg.wait_for_timeout(500)
    check("The selected part can be changed straight away", float(frame(pg).locator("[data-el='line']").first.evaluate("e => getComputedStyle(e).fontSize")[:-2]) > 20.3)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    # Clicking a part on the page opens its section in the list.
    out = row(pg, "Outcomes").locator(".sec-toggle")
    check("Outcomes starts closed", out.get_attribute("aria-expanded") == "false")
    tap(pg, "#outcomes [data-el='skills-label']")
    check("Clicking a part on the page opens its section's parts and marks it", out.get_attribute("aria-expanded") == "true" and row(pg, "Outcomes").locator(".sec-parts button[aria-current='true']").inner_text() == "Skills heading")
    # A part in another section.
    row(pg, "Outcomes").locator(".sec-parts button", has_text="Skills line").click(); pg.wait_for_timeout(800)
    check("A part of another section can be chosen in one step", pg.locator(".ctx-name").first.inner_text() == "Skills line")
    # Sections without parts have no arrow; adding a section updates the list.
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    pg.locator(".sec-option", has_text="Space").first.click(); pg.wait_for_timeout(1500)
    sections(pg)
    r = pg.locator(".sec-row.is-selected").first
    check("A new Space section has no arrow (it has no parts)", r.count() == 1 and r.locator(".sec-toggle").count() == 0)
    # A section with several images: every name in its list is distinct.
    multi = None
    for i in range(pg.locator(".sec-row").count()):
        rr = pg.locator(".sec-row").nth(i)
        if rr.locator(".sec-toggle").count():
            if rr.locator(".sec-toggle").get_attribute("aria-expanded") == "false": rr.locator(".sec-toggle").click(); pg.wait_for_timeout(300)
            names = rr.locator(".sec-parts button").all_inner_texts()
            if sum(n.startswith("Image") for n in names) >= 2: multi = names; break
    check("Where a section has several images, each has its own name (Image 1, Image 2)", multi and len(set(multi)) == len(multi) and "Image 1" in multi, str(multi))
    bad = axe(pg)
    check("axe: no serious or critical problems with parts open", not bad, json.dumps(bad)[:300])
    # The side panel points to Sections instead of keeping a second list.
    pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Outcomes")).locator(".sec-go").click(); pg.wait_for_timeout(700)
    pg.get_by_role("button", name=re.compile("^(All )?[Ss]ettings$")).first.click(); pg.wait_for_timeout(600)
    g = pg.locator("section.el-group[aria-label='Parts of this section']:visible")
    check("Side panel: no second list, a note and a link to Sections instead", g.count() == 1 and g.locator("li").count() == 0 and "listed under it in Sections" in g.inner_text())
    pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Outcomes")).locator(".sec-toggle").click(); pg.wait_for_timeout(300)  # close it first
    g.get_by_role("button", name="Show its parts in Sections").click(); pg.wait_for_timeout(700)
    check("…which opens that section's parts and moves focus to the first one", row(pg, "Outcomes").locator(".sec-toggle").get_attribute("aria-expanded") == "true" and pg.evaluate("!!document.activeElement.closest('.sec-parts')"))
    pg.close()

    # 2. Keyboard only.
    pg, e = fresh(br); errors += e
    sections(pg)
    t = row(pg, "Opening").locator(".sec-toggle"); t.focus()
    pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(300)
    check("Keyboard: Right arrow opens a section's parts", t.get_attribute("aria-expanded") == "true")
    pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(200)
    first = pg.evaluate("document.activeElement.innerText")
    check("Keyboard: Right arrow again moves into its parts", pg.evaluate("!!document.activeElement.closest('.sec-parts')"), first)
    pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(100); pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(100)
    target = pg.evaluate("document.activeElement.innerText")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(800)
    check("Keyboard: Down arrow and Enter select a part", pg.locator(".ctx-name").first.inner_text() == target, target)
    t.focus(); pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(300)
    check("Keyboard: Left arrow closes it", t.get_attribute("aria-expanded") == "false")
    t.focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    check("Keyboard: Enter or Space on the arrow opens it too", t.get_attribute("aria-expanded") == "true")
    pg.locator(".sec-parts button").first.focus(); pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(200)
    check("Keyboard: Left arrow from a part goes back to its section's arrow", pg.evaluate("document.activeElement.classList.contains('sec-toggle')"))
    tab = pg.evaluate("[...document.querySelectorAll('.sec-row')].slice(0,2).flatMap(r => [...r.querySelectorAll('button')].map(b => b.className.split(' ')[0]))")
    check("Tab order in a row: arrow, section, its menu, then its parts", tab[:3] == ["sec-toggle", "sec-go", "sec-more"], str(tab[:6]))
    sz = pg.evaluate("[...document.querySelectorAll('.sec-toggle, .sec-parts button')].map(b => { const r = b.getBoundingClientRect(); return [r.width, r.height] })")
    check("Targets are at least 24 px (WCAG 2.5.8)", all(w >= 24 and h >= 24 for w, h in sz), str(sz[:4]))
    pg.close()

    # 3. Phone, touch.
    pg, e = fresh(br, 390, 844, touch=True); errors += e
    sections(pg)
    t = row(pg, "Opening").locator(".sec-toggle")
    t.tap(); pg.wait_for_timeout(400)
    check("Phone: tapping the arrow opens the parts", t.get_attribute("aria-expanded") == "true")
    over = pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
    widest = pg.evaluate("Math.max(...[...document.querySelectorAll('.sec-parts button')].map(b => b.getBoundingClientRect().right))")
    check("Phone: nothing runs off the side", not over and widest <= 390, str(widest))
    row(pg, "Opening").locator(".sec-parts button", has_text="Title").first.tap(); pg.wait_for_timeout(900)
    check("Phone: tapping a part selects it", pg.locator(".ctx-name").first.inner_text() == "Title")
    # Focus a part low in the list: it must not end up hidden under the sticky tabs.
    last = row(pg, "Opening").locator(".sec-parts button").last; last.focus(); pg.wait_for_timeout(300)
    tabs = pg.locator(".sec-tabs").bounding_box(); lb = last.bounding_box()
    check("Phone: a focused part is never hidden under the Sections tabs", lb["y"] >= tabs["y"] + tabs["height"] - 1, f"{lb} {tabs}")
    pg.evaluate("(() => { let s = document.querySelector('.sec-panel'); while (s && !(s.scrollHeight > s.clientHeight)) s = s.parentElement; if (s) s.scrollTop = 0 })()"); pg.wait_for_timeout(300)
    bad = axe(pg)
    check("Phone: axe finds no serious or critical problems", not bad, json.dumps(bad)[:300])
    pg.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
