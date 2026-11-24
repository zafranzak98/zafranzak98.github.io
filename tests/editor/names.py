# Round 5, item 2: every control in the contextual bar has a name a screen reader can announce, at
# phone (390), tablet (768) and desktop (1440) widths, in each selection state: nothing selected, a
# section, a text part, a photo, and several parts together. Also runs axe on the editor at each step.
# Run from the repository root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import re, json, os
from playwright.sync_api import sync_playwright
from seed import seed, image, PHOTOS
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = os.environ.get("EDITOR_URL", "http://localhost:4302/admin/design/?project=about-face-beauty")
AXE = os.environ.get("AXE") or next(p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p))
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]

def fresh(br, w, h):
    pg = br.new_page(viewport={"width": w, "height": h}, bypass_csp=True); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    return pg, errs

def tap(pg, sel, shift=False, edge=False):
    el = frame(pg).locator(sel).first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); b = el.bounding_box()
    if shift: pg.keyboard.down("Shift")
    pg.mouse.click(b["x"] + (6 if edge else b["width"] / 2), b["y"] + b["height"] / 2)
    if shift: pg.keyboard.up("Shift")
    pg.wait_for_timeout(700)

# Every visible button in the bar, with the name the browser's accessibility tree gives it.
NAMES = """() => [...document.querySelectorAll('.ctx button, .ctx input, .ctx select')].filter(b => b.getClientRects().length).map(b => {
  const lab = b.getAttribute('aria-label') || (b.getAttribute('aria-labelledby') && document.getElementById(b.getAttribute('aria-labelledby'))?.innerText) || ''
  return { name: (lab || b.innerText || b.title || '').trim(), html: b.outerHTML.slice(0, 120) } })"""

def axe(pg):
    pg.add_script_tag(path=AXE)
    out = pg.evaluate("""async () => (await axe.run({ exclude: [['#preview-frame']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
      .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, where: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }))""")
    return out

def state(pg, w, label):
    pg.wait_for_timeout(300)
    items = pg.evaluate(NAMES)
    unnamed = [i["html"] for i in items if not i["name"]]
    check(f"{w}px, {label}: all {len(items)} bar controls have a name", not unnamed, json.dumps(unnamed)[:300])
    if label == "nothing selected":
        sc = pg.evaluate("(() => { const c = document.querySelector('.ctx'); const h = c.querySelector('.ctx-hint'); return { scroll: c.scrollWidth > c.clientWidth + 1, cut: h.scrollHeight > c.clientHeight } })()")
        check(f"{w}px, nothing selected: the tip fits the bar without scrolling or being cut off", not sc["scroll"] and not sc["cut"], str(sc))
    bad = axe(pg)
    check(f"{w}px, {label}: axe finds no serious or critical problems", not bad, json.dumps(bad)[:400])

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []
    for w, h in [(390, 844), (768, 1024), (1440, 900)]:
        pg, e = fresh(br, w, h); errors += e
        if pg.locator(".sec-panel:visible").count() and w < 638: pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        state(pg, w, "nothing selected")

        tap(pg, "[data-el='title']")
        state(pg, w, "a text part")
        s = pg.get_by_role("button", name=re.compile("^(All )?[Ss]ettings$")).first
        check(f"{w}px: the settings button is announced by name, with its on/off state", s.count() and s.get_attribute("aria-pressed") in ("true", "false"))

        tap(pg, "#outcomes [data-el='skills-label']", edge=True)
        tap(pg, "#outcomes [data-el='skills']", shift=True, edge=True)
        n = pg.locator(".ctx-name").first.inner_text(); check(f"{w}px: two parts selected", "selected" in n, n)
        state(pg, w, "several parts")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)

        if not pg.get_by_role("tab", name="Add a section").count(): pg.get_by_role("button", name="Sections").first.click(); pg.wait_for_timeout(500)
        pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
        pg.locator(".sec-option", has_text="Space").first.click(); pg.wait_for_timeout(1200)
        if pg.locator(".sec-panel:visible").count() and w < 638: pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        state(pg, w, "a section")

        seed(pg, [image(PHOTOS["brand proposal cover art"])])
        if pg.locator(".sec-panel:visible").count() and w < 900: pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        tap(pg, ".free-photo")
        state(pg, w, "a photo")
        pg.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
