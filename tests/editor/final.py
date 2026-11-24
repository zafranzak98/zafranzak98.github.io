# Final refinements (24 Nov): A links in the page never leave the editor; B settings choices never cut
# off at 768 to 1280 px; C Present the photo for photos placed in the website editor; D section names
# wrap instead of being cut short; E a roomier phone layout with nothing hidden; F bold, italic and
# underline for selected words, with shortcuts, saving and Undo. Run from the repository root after
# `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import json, os, re
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
BASE = "http://localhost:4302/admin/design/?project="
KEY = "design-editor:{}:unsaved"
AXE = os.environ.get("AXE") or next((p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p)), None)
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def unsaved(pg, slug=None):
    slug = slug or re.search(r"project=([\w-]+)", pg.url).group(1)
    return pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY.format(slug)}')||'null')")
def fresh(br, w=1440, h=900, slug="about-face-beauty", touch=False):
    c = br.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch and w < 900, bypass_csp=True)
    pg = c.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + slug, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2200)
    if touch and pg.locator(".sec-panel:visible").count(): pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    return pg, errs
def tap(pg, sel, x=8):
    el = frame(pg).locator(sel).first; el.evaluate("e => e.scrollIntoView({ block: 'center' })"); pg.wait_for_timeout(300); b = el.bounding_box()
    pg.mouse.click(b["x"] + min(x, b["width"] / 2), b["y"] + b["height"] / 2); pg.wait_for_timeout(700)
def settings(pg):
    s = pg.locator(".ctx .ctx-settings").first
    if s.get_attribute("aria-pressed") != "true": s.click(); pg.wait_for_timeout(600)
def panel(pg): return pg.locator(".el-panel:visible").first
def select_words(pg, start, end):
    frame(pg).evaluate("""([a, b]) => { const box = document.querySelector('.el-typing'); const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n, at = 0, r = document.createRange(), s = false
      while ((n = w.nextNode())) { const len = n.textContent.length
        if (!s && a <= at + len) { r.setStart(n, a - at); s = true }
        if (s && b <= at + len) { r.setEnd(n, b - at); break }
        at += len }
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r) }""", [start, end])
def summary(pg): pg.wait_for_timeout(1200); return ((unsaved(pg) or {}).get("root", {}).get("props", {}).get("edits") or {}).get("summary")
def elements(pg, block_type):
    pg.wait_for_timeout(1500)  # unsaved work is stored a moment after each change
    for i in (unsaved(pg) or {}).get("content", []):
        if i["type"] == block_type: return i["props"].get("elements") or {}
    return {}

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []

    # ---- F. Bold, italic and underline for selected words.
    pg, e = fresh(br); errors += e
    tap(pg, "[data-el='line']")
    fmt = pg.locator(".ctx .ctx-format")
    check("F: a part with formatted words shows Bold, Italic and Underline", fmt.count() == 1 and "is-off" not in (fmt.get_attribute("class") or "") and [b.get_attribute("aria-label") for b in fmt.locator("button").all()] == ["Bold", "Italic", "Underline"])
    tap(pg, "#outcomes [data-el='skills-label']")
    check("F: a label (plain words) shows them greyed, with the reason (Demo 5.2)", pg.locator(".ctx .ctx-format.is-off").count() == 1 and "styled as a whole" in (pg.locator(".ctx .ctx-format").get_attribute("title") or ""))
    tap(pg, "[data-el='line']")
    original = frame(pg).locator("[data-el='line']").inner_text().strip()
    f = frame(pg); el = f.locator("[data-el='line']").first; b = el.bounding_box(); pg.mouse.dblclick(b["x"] + 8, b["y"] + b["height"] / 2); pg.wait_for_timeout(500)
    box = f.locator(".el-typing")
    check("F: typing formatted words uses a rich copy", box.get_attribute("contenteditable") == "true")
    select_words(pg, 0, 5)  # "Three"
    pg.locator(".ctx .ctx-format button[aria-label='Bold']").click(); pg.wait_for_timeout(200)
    check("F: Bold formats only the selected word and typing goes on", box.count() == 1 and box.locator("b").inner_text() == "Three" and box.inner_text().strip() == original)
    check("F: Bold shows as pressed for the selection", pg.locator(".ctx .ctx-format button[aria-label='Bold']").get_attribute("aria-pressed") == "true")
    select_words(pg, 6, 15)  # "Instagram"
    pg.keyboard.press("Control+i"); pg.wait_for_timeout(150)
    select_words(pg, 16, 18)  # "AR"
    pg.keyboard.press("Control+u"); pg.wait_for_timeout(150)
    check("F: Ctrl+I and Ctrl+U format other words; the bold word stays bold", box.locator("i").inner_text() == "Instagram" and box.locator("u").inner_text() == "AR" and box.locator("b").inner_text() == "Three")
    # Caret with nothing selected: the format applies to what is typed next.
    frame(pg).evaluate("() => { const box = document.querySelector('.el-typing'); const r = document.createRange(); r.selectNodeContents(box); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r) }")
    pg.locator(".ctx .ctx-format button[aria-label='Italic']").click(); pg.wait_for_timeout(100)
    pg.keyboard.type(" New"); pg.wait_for_timeout(100)
    check("F: with no selection, Italic applies to what is typed next", any(t.strip() == "New" for t in box.locator("i").all_inner_texts()), box.inner_html()[-120:])
    pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
    stored = summary(pg)
    check("F: stored with markers, formatting kept apart", stored and stored.startswith("*Three* _Instagram_ ++AR++ makeup") and stored.endswith("_New_"), stored)
    page = frame(pg).locator("[data-el='line']").first
    check("F: the page shows bold, italic and underline in those places only", page.locator("strong").inner_text() == "Three" and page.locator("em").first.inner_text() == "Instagram" and page.locator("u").inner_text() == "AR")
    hist = pg.locator(".editor-history button").first
    check("F: Undo names the step", "words" in (hist.get_attribute("aria-label") or "").lower(), hist.get_attribute("aria-label"))
    hist.click(); pg.wait_for_timeout(700)
    check("F: Undo removes the formatting", frame(pg).locator("[data-el='line'] strong, [data-el='line'] em, [data-el='line'] u").count() == 0)
    pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(700)
    check("F: Redo brings it back", summary(pg) == stored)
    # Remove bold from part of the bold word, and paste stays plain.
    tap(pg, "[data-el='line']")
    pg.mouse.dblclick(b["x"] + 8, b["y"] + b["height"] / 2); pg.wait_for_timeout(500); box = frame(pg).locator(".el-typing")
    select_words(pg, 0, 5); pg.keyboard.press("Control+b"); pg.wait_for_timeout(150)
    pg.evaluate("() => {}")
    frame(pg).evaluate("() => { const box = document.querySelector('.el-typing'); const r = document.createRange(); r.selectNodeContents(box); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); const dt = new DataTransfer(); dt.setData('text/html', '<b>Pasted</b>'); dt.setData('text/plain', ' Pasted'); box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) }")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(800)
    s2 = summary(pg)
    check("F: Ctrl+B again removes bold; pasted words bring no formatting of their own", s2 and s2.startswith("Three _Instagram_") and "*Pasted" not in s2 and "Pasted" in s2, s2)
    # Saved, reopened and edited again.
    pg.locator(".editor-save").click(); pg.wait_for_timeout(1000)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    check("F: after Save draft and reopening, the formatting is still there", frame(pg).locator("[data-el='line'] em").first.inner_text() == "Instagram" and frame(pg).locator("[data-el='line'] u").inner_text() == "AR")
    tap(pg, "[data-el='line']"); settings(pg)
    wb = pg.locator(".el-panel .el-words-rich >> visible=true")
    check("F: the Words box shows the saved formatting, not markers (Demo 5.2)", wb.count() == 1 and wb.locator("i, em").first.inner_text() == "Instagram" and wb.locator("u").first.inner_text() == "AR" and "_" not in wb.inner_text() and "++" not in wb.inner_text())
    pg.close()

    # ---- A. Links in the page never replace the page being edited.
    pg, e = fresh(br); errors += e
    f = frame(pg); u0 = f.url
    link = f.locator("a[href='/projects/brand-communications/fc-yeah/']").first
    link.focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(1500)
    f2 = frame(pg)
    check("A: Enter on a page link (nothing selected) keeps the editable page", f2.url == u0 and f2.locator("[data-el]").count() > 20, f2.url[-50:])
    check("A: ...selects the part the link belongs to", pg.locator(".ctx-name").count() and pg.locator(".ctx-name").first.inner_text() != "", pg.locator(".ctx-name").all_inner_texts()[:1])
    link.focus(); pg.keyboard.press("Space"); pg.wait_for_timeout(800)
    check("A: Space on a link does not leave either", frame(pg).url == u0)
    lb = link.bounding_box(); pg.mouse.click(lb["x"] + 4, lb["y"] + lb["height"] / 2); pg.wait_for_timeout(1000)
    check("A: a mouse click on a link stays too", frame(pg).url == u0)
    jump = f.locator("a[href='#outcomes']").first
    jump.focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(800)
    check("A: a jump within the page (#outcomes) still works", frame(pg).url == u0 and f.evaluate("document.querySelector('#outcomes').getBoundingClientRect().top < innerHeight"))
    pg.get_by_role("button", name="Preview").first.click(); pg.wait_for_timeout(700)
    link.focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(1200)
    check("A: in Preview, a page link stays in the editor too", frame(pg).url == u0 and frame(pg).locator("[data-el]").count() > 20)
    pg.close()

    # ---- B. Settings choices are never cut off.
    for w, h in [(768, 1024), (1024, 768), (1180, 820), (1280, 800), (1440, 900), (1920, 1080)]:
        pg, e = fresh(br, w, h); errors += e
        bad = []
        for sel in ["#outcomes [data-el='skills-label']", ".cs-open-visual"]:
            el = frame(pg).locator(sel).first; el.scroll_into_view_if_needed(); bb = el.bounding_box(); pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(700)
            settings(pg)
            bad += pg.evaluate("""() => { const side = document.querySelector('.el-panel:not([hidden])'); const p = [...document.querySelectorAll('.el-panel')].find(x => x.getClientRects().length && x.getBoundingClientRect().width > 0)
              const box = p.closest("[class*='_Sidebar']")?.getBoundingClientRect() ?? { left: 0, right: innerWidth }
              return [...p.querySelectorAll('button, select, input, textarea, h3, .el-note, label')].filter(e => e.getClientRects().length).flatMap(e => { const r = e.getBoundingClientRect(); const out = []
                if (r.right > Math.min(box.right, innerWidth) + 0.5 || r.left < box.left - 0.5) out.push('outside: ' + (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 20))
                if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 1) out.push('cut: ' + e.innerText.trim().slice(0, 20))
                return out }).concat(p.scrollWidth > p.clientWidth + 1 ? ['panel scrolls sideways'] : []) }""")
        check(f"B {w}px: every setting fits the panel, no label cut off, no sideways scroll", not bad, str(bad[:4]))
        if w in (1024, 1440):
            el = frame(pg).locator("#outcomes [data-el='skills-label']").first; el.scroll_into_view_if_needed(); bb = el.bounding_box(); pg.mouse.click(bb["x"] + 6, bb["y"] + bb["height"] / 2); pg.wait_for_timeout(600); settings(pg)
            wt = panel(pg).locator("[aria-label='Weight'] button")
            check(f"B {w}px: the four weights are all readable and one step each", wt.count() == 4 and all(x.strip() for x in wt.all_inner_texts()))
            wt.filter(has_text="Semibold").click(); pg.wait_for_timeout(500)
            weight = frame(pg).evaluate("getComputedStyle(document.querySelector(\"#outcomes [data-el='skills-label']\")).fontWeight")
            check(f"B {w}px: choosing Semibold works", weight == "600", weight)
        pg.close()

    # ---- D. Section names wrap rather than being cut short.
    for w in (1024, 1440):
        pg, e = fresh(br, w, 900); errors += e
        if not pg.locator(".sec-panel:visible").count(): pg.get_by_role("button", name="Sections").first.click(); pg.wait_for_timeout(500)
        cut = pg.evaluate("[...document.querySelectorAll('.sec-panel .sec-list .sec-name')].filter(e => e.getClientRects().length && e.scrollHeight > e.clientHeight + 1).map(e => e.innerText)")
        names = pg.locator(".sec-panel .sec-list .sec-name").all_inner_texts()
        check(f"D {w}px: no section name is cut short", not cut and "Space before sections" in names and "Also in this category" in names, str(cut))
        over = pg.evaluate("(() => { const p = document.querySelector('.sec-panel'); return p.scrollWidth - p.clientWidth })()")
        check(f"D {w}px: the panel keeps its width (no sideways scroll)", over <= 1, str(over))
        rows = pg.locator(".sec-row .sec-go").evaluate_all("els => els.map(e => e.getBoundingClientRect().height)")
        check(f"D {w}px: rows stay at least 44 px to tap", min(rows) >= 44, str(min(rows)))
        pg.close()

    # ---- C. Present the photo for photos placed in the website editor.
    pg, e = fresh(br, 1440, 900, "cancel-me-not"); errors += e
    tap(pg, "#work [data-el='key']", x=200); settings(pg)
    g = pg.locator("section.el-group[aria-label='Look: Photo']:visible")
    check("C: a project photo has Look: Photo", g.count() == 1)
    labels = g.locator(".el-row-head > span").all_inner_texts()
    check("C: Size, Width on this screen, Shape, Fit, Crop focus and Angle", labels[:4] == ["Size", "Width on this screen", "Shape", "Fit"] and "Crop focus" in labels and "Angle" in labels, str(labels))
    check("C: no way to add, choose or replace a photo", pg.locator("button:visible", has_text=re.compile("choose a photo|replace photo|upload", re.I)).count() == 0)
    img = lambda key: frame(pg).evaluate(f"""() => {{ const i = document.querySelector("#work [data-el='{key}'] img"); const r = i.getBoundingClientRect(); const c = getComputedStyle(i); return {{ w: r.width, h: r.height, fit: c.objectFit, nat: i.naturalWidth / i.naturalHeight, box: i.closest('[data-el]').getBoundingClientRect().width, src: i.currentSrc }} }}""")
    before = img("key")
    g.locator("[aria-label='Size'] button", has_text="Narrow").click(); pg.wait_for_timeout(700)
    after = img("key")
    check("C: Narrow makes the photo narrower (30rem)", after["box"] < before["box"] and abs(after["box"] - 30 * 18) < 40, f"{before['box']:.0f} → {after['box']:.0f}")
    g.locator("select[aria-label='Shape']").select_option("auto"); pg.wait_for_timeout(700)
    own = img("key")
    check("C: Its own shape shows the whole photo at its proportions", abs(own["w"] / own["h"] - own["nat"]) < 0.02, f"{own['w'] / own['h']:.3f} vs {own['nat']:.3f}")
    check("C: with its own shape, Fit and Crop focus are not offered", g.locator(".el-row-head > span", has_text="Fit").count() == 0 and g.locator(".el-row-head > span", has_text="Crop focus").count() == 0)
    g.locator("select[aria-label='Shape']").select_option("1/1"); pg.wait_for_timeout(700)
    sq = img("key")
    check("C: Square makes a square frame", abs(sq["w"] / sq["h"] - 1) < 0.02)
    g.locator("[aria-label='Fit'] button", has_text="Show the whole photo").click(); pg.wait_for_timeout(600)
    check("C: Show the whole photo keeps all of it (contain), no crop focus", img("key")["fit"] == "contain" and g.locator(".el-row-head > span", has_text="Crop focus").count() == 0)
    g.locator("[aria-label='Fit'] button", has_text="Fill the frame").click(); pg.wait_for_timeout(600)
    g.locator(".el-focus button").nth(0).click(); pg.wait_for_timeout(600)
    pos = frame(pg).evaluate("getComputedStyle(document.querySelector(\"#work [data-el='key'] img\")).objectPosition")
    check("C: Fill the frame with a crop focus (top left)", img("key")["fit"] == "cover" and pos.startswith("0%"), pos)
    look = elements(pg, "Work").get("key") or {}
    check("C: span on Desktop; shape and fit stored once for every size", look.get("desktop", {}).get("span") == "narrow" and look.get("desktop", {}).get("shape") == "1/1" and "fit" not in look.get("desktop", {}), json.dumps(look))
    check("C: the photo file is unchanged", img("key")["src"].split("/")[-1].split("-w")[0].split(".")[0] == before["src"].split("/")[-1].split("-w")[0].split(".")[0])
    # Tablet and Phone.
    pg.get_by_role("button", name=re.compile("^Phone")).first.click(); pg.wait_for_timeout(1200)
    ph = img("key")
    check("C: on Phone the photo uses the full width despite Narrow on Desktop, still square", ph["box"] > 300 and abs(ph["w"] / ph["h"] - 1) < 0.02, f"{ph['box']:.0f}")
    tap(pg, "#work [data-el='key']", x=100); settings(pg); g = pg.locator("section.el-group[aria-label='Look: Photo']:visible")
    g.locator("[aria-label='Size'] button", has_text="Wide").click(); pg.wait_for_timeout(700)
    check("C: Phone can have its own size (Wide, 80%)", abs(img("key")["box"] / frame(pg).evaluate("document.querySelector('#work .work-key').parentElement.getBoundingClientRect().width") - 0.8) < 0.05)
    pg.get_by_role("button", name=re.compile("^Desktop")).first.click(); pg.wait_for_timeout(1200)
    check("C: Desktop is still Narrow", abs(img("key")["box"] - 30 * 18) < 40, f"{img('key')['box']:.0f}")
    # Reset and Undo.
    tap(pg, "#work [data-el='key']", x=100); settings(pg); g = pg.locator("section.el-group[aria-label='Look: Photo']:visible")
    g.get_by_role("button", name="Shape: back to as designed").click(); pg.wait_for_timeout(700)
    check("C: the shape's ↺ puts it back as designed (16:9)", abs(img("key")["w"] / img("key")["h"] - 16 / 9) < 0.02)
    pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(700)
    check("C: Undo brings the square back", abs(img("key")["w"] / img("key")["h"] - 1) < 0.02)
    # A gallery row shares its shape.
    tap(pg, "#work [data-el='image-1']", x=60); settings(pg); g = pg.locator("section.el-group[aria-label='Look: Photo']:visible")
    check("C: in a gallery row there is no Size (the row keeps its columns), and Shape says it is for the row", g.locator(".el-row-head > span", has_text=re.compile("^Size$")).count() == 0 and "for all 3 photos in this row" in g.inner_text())
    g.locator("select").first.select_option("16/9"); pg.wait_for_timeout(800)
    rows = [img(f"image-{i}") for i in range(3)]
    check("C: the whole row takes the shape and stays lined up", all(abs(r["w"] / r["h"] - 16 / 9) < 0.02 for r in rows) and len({round(r["h"]) for r in rows}) == 1, str([round(r["h"]) for r in rows]))
    g.locator("[aria-label='Fit'] button", has_text="Show the whole photo").click(); pg.wait_for_timeout(600)
    fits = [img(f"image-{i}")["fit"] for i in range(3)]
    check("C: Fit is each photo's own (only this one shows whole)", fits == ["cover", "contain", "cover"], str(fits))
    if AXE:
        pg.add_script_tag(path=AXE)
        bad = pg.evaluate("async () => (await axe.run({ include: [['.el-panel']] }, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] })).violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id)")
        check("C: axe finds no serious problems in the photo settings", not bad, str(bad))
    pg.close()

    # ---- E. Phones: more of the page shows and no tool is hidden.
    for w, h, min_page in [(320, 568, 250), (390, 844, 520), (430, 932, 600), (844, 390, 220)]:
        pg, e = fresh(br, w, h, touch=True); errors += e
        tap(pg, "[data-el='line']")
        m = pg.evaluate("""() => { const f = document.getElementById('preview-frame').getBoundingClientRect(); const c = document.querySelector('.editor-bar-ctx .ctx')
          const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'
          const off = [...document.querySelectorAll('.editor-bar button, .editor-bar select')].filter(vis).filter(b => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 || r.bottom < 0 }).map(b => b.getAttribute('aria-label') || b.innerText.trim())
          const small = [...document.querySelectorAll('.editor-bar button, .editor-bar select')].filter(vis).filter(b => { const r = b.getBoundingClientRect(); return r.width < 24 || r.height < 24 }).map(b => b.getAttribute('aria-label') || b.innerText.trim())
          return { page: Math.round(Math.min(innerHeight, f.bottom) - Math.max(0, f.top)), hidden: c.scrollWidth - c.clientWidth, off, small, over: document.documentElement.scrollWidth - innerWidth } }""")
        check(f"E {w}x{h}: at least {min_page} px of page shows with a part selected", m["page"] >= min_page, str(m["page"]))
        check(f"E {w}x{h}: no tool hidden off the side, none too small, no sideways scroll", m["hidden"] <= 1 and not m["off"] and not m["small"] and m["over"] <= 0, json.dumps({k: m[k] for k in ('hidden', 'off', 'small', 'over')}))
        names = [b.get_attribute("aria-label") or b.inner_text().strip() for b in pg.locator(".editor-bar button:visible").all()]
        need = ["Save draft", "Publish", "Undo", "Redo", "More", "Bold", "Italic", "Underline", "Edit words"]
        have = [n for n in need if any(x and x.startswith(n) for x in names)]
        check(f"E {w}x{h}: Save draft, Publish, Undo, Redo, More, Edit words and B/I/U are all on screen", have == need, str(sorted(set(need) - set(have))))
        st = pg.locator(".editor-status")
        check(f"E {w}x{h}: the save status keeps its words as its name", st.count() and st.inner_text().strip() in ("Same as the website", "Not saved yet"), st.inner_text())
        if w < 380:
            pg.locator(".editor-more-btn").click(); pg.wait_for_timeout(300)
            check(f"E {w}x{h}: Preview is in More", pg.locator(".editor-more.open .editor-more-preview").is_visible())
            pg.locator(".editor-more.open .editor-more-preview").click(); pg.wait_for_timeout(700)
            check(f"E {w}x{h}: ...and works", pg.evaluate("document.getElementById('preview-frame').contentDocument.documentElement.hasAttribute('data-preview')"))
        if AXE:
            pg.add_script_tag(path=AXE)
            bad = pg.evaluate("async () => (await axe.run({ include: [['.editor-bar']] }, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] })).violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id)")
            check(f"E {w}x{h}: axe finds no serious problems in the bar", not bad, str(bad))
        pg.close()
    # Phone: More options opens and works by touch.
    pg, e = fresh(br, 390, 844, touch=True); errors += e
    tap(pg, "#outcomes [data-el='skills-label']")
    pg.locator(".ctx .ctx-more").tap(); pg.wait_for_timeout(400)
    check("E: on a phone, More options (⋯) opens its menu", pg.locator(".ctx-more-menu").is_visible() and "Hide" in pg.locator(".ctx-more-menu").inner_text(), pg.locator(".ctx-more-menu").inner_text()[:80] if pg.locator(".ctx-more-menu").count() else "none")
    pg.close()

    check("No script errors", not errors, str(errors[:3]))
    br.close()
print(f"{sum(res)} of {len(res)} passed")
