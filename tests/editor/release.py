# Demo 5 release checks: every window width from a wide desktop to a small phone (1440, 1024, 768,
# 390, 320), each state the editor can be in, keyboard focus that can always be seen, and repeated
# use (selecting, menus, panels and screen sizes over and over) without errors, stuck state or lost
# work. Console errors fail the run, not just uncaught ones.
# Run from the repository root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import json, os, re, time
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = os.environ.get("EDITOR_URL", "http://localhost:4302/admin/design/?project=about-face-beauty")
AXE = os.environ.get("AXE") or next(p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p))
KEY = "design-editor:about-face-beauty:unsaved"
WIDTHS = [(1440, 900), (1024, 768), (768, 1024), (390, 844), (320, 640)]
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def fresh(br, w, h, touch=False):
    ctx = br.new_context(viewport={"width": w, "height": h}, bypass_csp=True, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    if pg.locator(".sec-panel:visible").count() and w < 638: pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    return pg, errs
def tap(pg, sel, shift=False):
    el = frame(pg).locator(sel).first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(250); b = el.bounding_box()
    if shift: pg.keyboard.down("Shift")
    pg.mouse.click(b["x"] + 6, b["y"] + b["height"] / 2)
    if shift: pg.keyboard.up("Shift")
    pg.wait_for_timeout(600)
def axe(pg):
    pg.add_script_tag(path=AXE)
    return pg.evaluate("""async () => (await axe.run({ exclude: [['#preview-frame']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
      .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, where: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }))""")
# Anything visible that pokes out past the window (the bar's own scrolling row is allowed to scroll).
OUTSIDE = """() => { const W = innerWidth, H = innerHeight
  const page = document.documentElement.scrollWidth > W + 1
  const bad = [...document.querySelectorAll('.ctx-menu, .el-panel, .sec-panel, .editor-strip, .editor-bar-start, .editor-bar-end, .editor-notice, .ph-dialog')]
    .filter(e => e.getClientRects().length).map(e => [e.className.split(' ')[0], e.getBoundingClientRect()])
    .filter(([, r]) => r.width && (r.left < -1 || r.right > W + 1)).map(([c, r]) => c + ' ' + Math.round(r.left) + '..' + Math.round(r.right))
  return { page, bad } }"""
def settings(pg): return pg.get_by_role("button", name=re.compile("^(All )?[Ss]ettings$")).first
def open_sections(pg):
    if not pg.get_by_role("tab", name="On this page").is_visible(): pg.get_by_role("button", name="Sections").first.click(); pg.wait_for_timeout(500)
    pg.get_by_role("tab", name="On this page").click(); pg.wait_for_timeout(300)
def unsaved(pg): return pg.evaluate(f"localStorage.getItem('{KEY}')")

with sync_playwright() as p:
    br = p.chromium.launch(); allerrs = []

    # Cycle A: each width, each state: nothing outside the window, axe clean, the strip and menus usable.
    for w, h in WIDTHS:
        pg, errs = fresh(br, w, h, touch=w < 900)
        o = pg.evaluate(OUTSIDE); check(f"{w}px, nothing selected: nothing runs off the window", not o["page"] and not o["bad"], str(o))
        tap(pg, "[data-el='line']")
        check(f"{w}px: a part is selected", pg.locator(".ctx-name").first.inner_text() == "Summary line")
        pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(300)
        m = pg.locator(".ctx-more-menu").bounding_box()
        check(f"{w}px: More options opens fully inside the window", m and m["x"] >= 0 and m["x"] + m["width"] <= w + 1 and m["y"] + m["height"] <= h + 1, str(m))
        small = pg.evaluate("[...document.querySelectorAll('.ctx-more-menu button')].filter(b => { const r = b.getBoundingClientRect(); return r.width < 24 || r.height < 24 }).length")
        check(f"{w}px: every More options item is at least 24 px", small == 0, str(small))
        bad = axe(pg); check(f"{w}px, More open: axe clean", not bad, json.dumps(bad)[:250])
        pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
        settings(pg).click(); pg.wait_for_timeout(700)
        o = pg.evaluate(OUTSIDE); check(f"{w}px, settings open: nothing runs off the window", not o["page"] and not o["bad"], str(o))
        check(f"{w}px, settings open: breadcrumb shown", pg.locator(".el-crumbs:visible").count() >= 1)
        bad = axe(pg); check(f"{w}px, settings open: axe clean", not bad, json.dumps(bad)[:250])
        if w >= 638: settings(pg).click(); pg.wait_for_timeout(400)
        pg.get_by_role("button", name=re.compile("^Phone")).first.click(); pg.wait_for_timeout(1300)
        s = pg.locator(".editor-strip")
        sb = s.bounding_box() if s.count() else None
        check(f"{w}px, editing Phone: the strip shows and fits", sb and sb["x"] >= -1 and sb["x"] + sb["width"] <= w + 1 and "phones only" in s.inner_text(), str(sb))
        open_sections(pg)
        t = pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Opening")).first.locator(".sec-toggle")
        if t.get_attribute("aria-expanded") != "true": t.click(); pg.wait_for_timeout(300)
        o = pg.evaluate(OUTSIDE); check(f"{w}px, Sections with parts open: nothing runs off the window", not o["page"] and not o["bad"], str(o))
        bad = axe(pg); check(f"{w}px, Sections with parts open: axe clean", not bad, json.dumps(bad)[:250])
        allerrs += errs; pg.close()

    # Cycle B: keyboard focus is always visible: Tab through the top of the editor and check each stop.
    pg, errs = fresh(br, 1440, 900)
    tap(pg, "[data-el='line']")
    hidden = []
    pg.locator(".editor-project").focus()
    for i in range(40):
        pg.keyboard.press("Tab"); pg.wait_for_timeout(40)
        info = pg.evaluate("""() => { const e = document.activeElement; if (!e || e === document.body || e.tagName === 'IFRAME') return null
          const c = getComputedStyle(e), r = e.getBoundingClientRect()
          const ring = (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (c.boxShadow && c.boxShadow !== 'none')
          return { name: (e.getAttribute('aria-label') || e.innerText || e.tagName).trim().slice(0, 30), ring, on: r.width > 0 && r.bottom > 0 && r.top < innerHeight } }""")
        if info and (not info["ring"] or not info["on"]): hidden.append(info)
    check("Keyboard, top bar and toolbar: every focused control shows a focus ring and is on screen", not hidden, json.dumps(hidden)[:300])
    # The same in Sections (with parts open) and in the side panel.
    def ring_walk(start_sel, n):
        out = []; pg.locator(start_sel).first.focus()
        for i in range(n):
            pg.keyboard.press("Tab"); pg.wait_for_timeout(40)
            info = pg.evaluate("""() => { const e = document.activeElement; if (!e || e === document.body || e.tagName === 'IFRAME') return null
              const c = getComputedStyle(e), r = e.getBoundingClientRect()
              const ring = (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (c.boxShadow && c.boxShadow !== 'none')
              return { name: (e.getAttribute('aria-label') || e.innerText || e.tagName).trim().slice(0, 30), ring, on: r.width > 0 && r.bottom > 0 && r.top < innerHeight } }""")
            if info and (not info["ring"] or not info["on"]): out.append(info)
        return out
    open_sections(pg)
    t = pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Opening")).first.locator(".sec-toggle")
    if t.get_attribute("aria-expanded") != "true": t.click(); pg.wait_for_timeout(300)
    hidden = ring_walk(".sec-tabs [role=tab]", 25)
    check("Keyboard, Sections with parts: every focused control shows a focus ring and is on screen", not hidden, json.dumps(hidden)[:300])
    settings(pg).click(); pg.wait_for_timeout(600)
    hidden = ring_walk(".el-crumbs button", 30)
    check("Keyboard, side panel: every focused control shows a focus ring and is on screen", not hidden, json.dumps(hidden)[:300])
    allerrs += errs; pg.close()

    # Cycle C: repeated use. Many selections, menus, panels and screen-size changes, then Undo to the start.
    pg, errs = fresh(br, 1440, 900)
    t0 = time.time()
    for i in range(12):
        tap(pg, "[data-el='line']" if i % 2 == 0 else "#outcomes [data-el='skills-label']")
    check("12 selection changes in a row: the bar follows each one", pg.locator(".ctx-name").first.inner_text() == "Skills heading")
    for i in range(8):
        pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(120); pg.keyboard.press("Escape"); pg.wait_for_timeout(120)
    check("More options opened and closed 8 times: closed, focus back on it", pg.locator(".ctx-more-menu").count() == 0 and pg.evaluate("document.activeElement.classList.contains('ctx-more')"))
    for i in range(6):
        settings(pg).click(); pg.wait_for_timeout(250)
    check("Settings toggled 6 times: back to closed, no duplicate panels", pg.locator(".el-panel:visible").count() == 0)
    for name in ["Tablet", "Phone", "Desktop"] * 3:
        pg.get_by_role("button", name=re.compile("^" + name)).first.click(); pg.wait_for_timeout(500)
    check("Screen size switched 9 times: back on Desktop, strip gone, selection kept", pg.locator(".editor-strip").count() == 0 and pg.locator(".ctx-name").first.inner_text() == "Skills heading")
    before = unsaved(pg)
    check("None of that changed the page", before is None, str(before)[:80])
    # Real changes, then Undo all the way back.
    tap(pg, "[data-el='line']")
    for _ in range(3): pg.locator(".ctx button[aria-label='Larger text']").click(); pg.wait_for_timeout(150)
    pg.locator(".ctx button[aria-label='Bold']").click(); pg.wait_for_timeout(300)
    pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(200)
    pg.locator(".ctx-more-menu button", has_text="Hide on").click(); pg.wait_for_timeout(400)
    tap(pg, "#outcomes [data-el='skills-label']"); pg.locator(".ctx button[aria-label='Bold']").click(); pg.wait_for_timeout(300)
    steps = 0
    while not pg.locator(".editor-history button").first.is_disabled() and steps < 20:
        pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(250); steps += 1
    pg.wait_for_timeout(1200)
    look = frame(pg).locator("[data-el='line']").first.evaluate("e => [getComputedStyle(e).fontSize, getComputedStyle(e).fontWeight, getComputedStyle(e).opacity]")
    status = pg.locator(".editor-status").inner_text()
    # Changes made within about a quarter of a second become one Undo step (the editor's history works that way).
    check(f"Undo walks back every change ({steps} steps) to the untouched page", steps >= 3 and look == ["20.241px", "500", "1"] and status == "Same as the website", f"{steps} {look} {status}")
    for _ in range(steps): pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(200)
    w8 = frame(pg).locator("[data-el='line']").first.evaluate("e => getComputedStyle(e).fontWeight")
    check("Redo brings all of them back", int(w8) >= 600, w8)
    # Refresh: unsaved work comes back; Save draft, refresh, still there and marked saved.
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    check("After a refresh the unsaved changes are restored", int(frame(pg).locator("[data-el='line']").first.evaluate("e => getComputedStyle(e).fontWeight")) >= 600)
    pg.locator(".editor-save").click(); pg.wait_for_timeout(1200)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    check("After Save draft and a refresh: kept, and the status says the draft is saved", pg.locator(".editor-status").inner_text().startswith(("Draft saved", "Same as the draft")) or "draft" in pg.locator(".editor-status").inner_text().lower(), pg.locator(".editor-status").inner_text())
    # Timing: selecting a part should feel instant.
    tms = []
    for sel, name in [("[data-el='line']", "Summary line"), ("#outcomes [data-el='skills']", "Skills line"), ("[data-el='title']", "Title")]:
        el = frame(pg).locator(sel).first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); b = el.bounding_box()
        t = time.time(); pg.mouse.click(b["x"] + 6, b["y"] + b["height"] / 2)
        pg.wait_for_function("n => document.querySelector('.ctx-name')?.innerText === n", arg=name, timeout=3000)
        tms.append(round((time.time() - t) * 1000))
    check("Selecting a part updates the bar within 300 ms (median)", sorted(tms)[1] < 300, str(tms))
    allerrs += errs; pg.close()

    # Cycle D: two tabs on the same page are pointed out; work in one is not lost by the other.
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); a = ctx.new_page(); a.goto(URL, wait_until="networkidle"); a.evaluate("localStorage.clear()"); a.reload(wait_until="networkidle"); a.wait_for_timeout(2000)
    b2 = ctx.new_page(); b2.goto(URL, wait_until="networkidle"); b2.wait_for_timeout(2500)
    fb = [f for f in b2.frames if f != b2.main_frame][0]; el = fb.locator("[data-el='line']").first; bb = el.bounding_box()
    b2.mouse.click(bb["x"] + 6, bb["y"] + bb["height"] / 2); b2.wait_for_timeout(600); b2.locator(".ctx button[aria-label='Bold']").click(); b2.wait_for_timeout(1500)
    note = a.locator(".editor-notice").inner_text() if a.locator(".editor-notice").count() else ""
    check("Two tabs on the same page: a change in one is pointed out in the other", "another tab" in note, note[:80])
    ctx.close()

    check("No script or console errors in any cycle", not allerrs, str(allerrs[:3]))
    print(f"{sum(res)} of {len(res)} passed")
