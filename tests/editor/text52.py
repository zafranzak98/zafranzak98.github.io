# Demo 5.2: one text-editing model. Weight sits next to Size; Bold, Italic and Underline are always in
# the same place, greyed with the reason where the text is styled as a whole; Facts values can be
# formatted; the Settings Words box shows formatting as formatting (never as markers) and formats the
# words selected in it; pasting is plain; on phones Aa opens a Text sheet with the same controls.
# Run from the repository root after `bun run build:preview` and `python3 tests/editor/serve.py dist 4302 &`.
import json, os
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = os.environ.get("EDITOR_URL", "http://localhost:4302/admin/design/?project=about-face-beauty")
AXE = os.environ.get("AXE") or next(p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p))
MOD = "Control"
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def fresh(br, w=1440, h=900):
    pg = br.new_page(viewport={"width": w, "height": h}, bypass_csp=True); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    return pg, errs
def tap(pg, sel, double=False):
    el = frame(pg).locator(sel).first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); b = el.bounding_box()
    (pg.mouse.dblclick if double else pg.mouse.click)(b["x"] + 6, b["y"] + b["height"] / 2)
    pg.wait_for_timeout(700)
def settings_open(pg):
    if not pg.locator(".el-panel .el-name >> visible=true").count(): pg.locator(".ctx .ctx-settings").first.click(); pg.wait_for_timeout(500)
def axe(pg):
    pg.add_script_tag(path=AXE)
    return pg.evaluate("""async () => (await axe.run({ exclude: [['#preview-frame']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
      .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, where: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }))""")

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []
    pg, e = fresh(br); errors += e

    # Names: one name for each thing at every size.
    tap(pg, "[data-el='line']")
    check("The settings button reads Settings", pg.locator(".ctx .ctx-settings").first.inner_text().strip() == "Settings", pg.locator(".ctx .ctx-settings").first.inner_text())
    check("The menu button reads More", pg.locator(".ctx .ctx-more").first.inner_text().replace("▾", "").strip() == "More", pg.locator(".ctx .ctx-more").first.inner_text())

    # Weight next to Size.
    sel = pg.locator(".ctx .ctx-weight select")
    check("Weight is in the bar, next to Size", sel.count() == 1 and sel.is_visible() and pg.evaluate("(() => { const s = document.querySelector('.ctx .ctx-size'); return s && s.nextElementSibling && s.nextElementSibling.classList.contains('ctx-weight') })()"))
    sel.select_option("600"); pg.wait_for_timeout(600)
    w = frame(pg).locator("[data-el='line']").first.evaluate("e => getComputedStyle(e).fontWeight")
    check("Choosing Semibold changes the whole text's weight", w == "600", w)
    check("Weight shows the chosen weight", sel.input_value() == "600", sel.input_value())
    pg.keyboard.press(f"{MOD}+z"); pg.wait_for_timeout(600)
    w2 = frame(pg).locator("[data-el='line']").first.evaluate("e => getComputedStyle(e).fontWeight")
    check("Undo takes the weight back in one step", w2 != "600", w2)
    tap(pg, "[data-el='line']")

    # Formatting buttons: live on rich text, greyed with the reason on titles.
    fmt = pg.locator(".ctx .ctx-format").first
    check("Summary: Bold, Italic and Underline are available", fmt.is_visible() and "is-off" not in (fmt.get_attribute("class") or ""))
    tap(pg, "[data-el='title']")
    fmt = pg.locator(".ctx .ctx-format").first
    check("Title: the buttons stay in place, greyed", fmt.is_visible() and "is-off" in (fmt.get_attribute("class") or "") and pg.locator(".ctx .ctx-format button[aria-disabled='true']").count() == 3)
    check("Title: the reason shows on hover", "styled as a whole" in (fmt.get_attribute("title") or ""), fmt.get_attribute("title"))
    before = frame(pg).locator("[data-el='title']").first.inner_html()
    pg.locator(".ctx .ctx-format button").first.click(force=True); pg.wait_for_timeout(500)
    check("Title: pressing a greyed button changes nothing", frame(pg).locator("[data-el='title']").first.inner_html() == before and not frame(pg).locator(".el-typing").count())
    check("Title: Weight is still available", pg.locator(".ctx .ctx-weight select").is_visible())
    settings_open(pg)
    check("Title in Settings: the Words box is plain, with the same greyed row and reason", pg.locator(".el-panel textarea.el-words >> visible=true").count() == 1 and pg.locator(".el-panel .el-format-row .is-off >> visible=true").count() == 1 and pg.locator(".el-panel .el-note >> visible=true", has_text="styled as a whole").count() == 1)

    # Facts values can be formatted, on the page.
    fact = "[data-el='value-tools']"
    check("Facts: tools accept formatting", frame(pg).locator(fact).first.get_attribute("data-rich") is not None)
    tap(pg, fact)
    check("Facts: Bold, Italic and Underline are available", "is-off" not in (pg.locator(".ctx .ctx-format").first.get_attribute("class") or ""))
    first = frame(pg).locator(fact).first.inner_text().split(",")[0].strip()
    tap(pg, fact, double=True)
    box = frame(pg).locator(".el-typing")
    # Select the first item only and make it bold.
    box.evaluate("""(b, first) => { const t = b.firstChild; const r = b.ownerDocument.createRange(); r.setStart(t, 0); r.setEnd(t, first.length); const s = b.ownerDocument.getSelection(); s.removeAllRanges(); s.addRange(r) }""", first)
    pg.keyboard.press(f"{MOD}+b"); pg.wait_for_timeout(200)
    pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
    strong = frame(pg).locator(f"{fact} strong").all_inner_texts()
    check("Facts: the first tool is bold on the page, the rest are not", strong == [first], f"{strong} vs {first}")
    check("Facts: the label stays a label (not formatted)", frame(pg).locator("[data-el='label-tools'] strong").count() == 0)

    # The Settings Words box shows formatting, not markers.
    settings_open(pg)
    words = pg.locator(".el-panel .el-words-rich >> visible=true")
    check("Settings: the Words box shows formatting as formatting", words.count() == 1 and words.locator("b, strong").first.inner_text() == first and "*" not in words.inner_text(), words.inner_text()[:80])
    # Format in the Words box: select the last word, press Italic.
    words.evaluate("""b => { const w = b.ownerDocument.createTreeWalker(b, NodeFilter.SHOW_TEXT); let last; while (w.nextNode()) last = w.currentNode; const r = b.ownerDocument.createRange(); const i = last.textContent.lastIndexOf(' ') + 1; r.setStart(last, i); r.setEnd(last, last.textContent.length); b.focus(); const s = b.ownerDocument.getSelection(); s.removeAllRanges(); s.addRange(r) }""")
    pg.locator(".el-panel .el-format-row button[aria-label='Italic'] >> visible=true").click(); pg.wait_for_timeout(700)
    check("Settings: Italic formats the words selected in the box, on the page too", frame(pg).locator(f"{fact} em").count() == 1, frame(pg).locator(fact).first.inner_html()[:200])
    # Shortcuts in the box.
    words.evaluate("b => { const r = b.ownerDocument.createRange(); r.selectNodeContents(b); r.collapse(false); b.focus(); const s = b.ownerDocument.getSelection(); s.removeAllRanges(); s.addRange(r) }")
    # Plain paste.
    pg.evaluate("""() => { const b = [...document.querySelectorAll(".el-words-rich")].find(e => e.offsetParent); const d = new DataTransfer(); d.setData('text/html', '<b style="color:red;font-family:Comic Sans MS">Pasted</b>'); d.setData('text/plain', ' Pasted'); b.dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })) }"""); pg.wait_for_timeout(700)
    html = frame(pg).locator(fact).first.inner_html()
    check("Settings: pasted words arrive plain", "Pasted" in html and "Comic" not in html and "red" not in html, html[-160:])
    check("Settings: Enter does not add a line", (words.evaluate("b => { b.focus(); return b.innerHTML }") or "") == words.evaluate("b => { b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return b.innerHTML }"))
    bad = axe(pg)
    check("1440px: axe finds no serious or critical problems with Settings open on a fact", not bad, json.dumps(bad)[:300])

    # A highlight phrase survives editing in the box.
    tap(pg, "[data-el='lead']")
    settings_open(pg)
    hl_before = frame(pg).locator("[data-el='lead'] mark").count()
    if hl_before:
        wb = pg.locator(".el-panel .el-words-rich >> visible=true")
        check("Highlight: shown as a highlight in the Words box", wb.locator("mark").count() == hl_before)
        wb.evaluate("b => { const r = b.ownerDocument.createRange(); r.selectNodeContents(b); r.collapse(false); b.focus(); const s = b.ownerDocument.getSelection(); s.removeAllRanges(); s.addRange(r) }")
        pg.keyboard.type(" Yes."); pg.wait_for_timeout(700)
        check("Highlight: typing in the box keeps the highlight on the page", frame(pg).locator("[data-el='lead'] mark").count() == hl_before and "Yes." in frame(pg).locator("[data-el='lead']").first.inner_text())
    pg.close()

    # Tablet: same names, same controls.
    pg, e = fresh(br, 1024, 768); errors += e
    tap(pg, "[data-el='line']")
    check("1024px: Settings reads Settings and Weight is in the bar", pg.locator(".ctx .ctx-settings").first.inner_text().strip() == "Settings" and pg.locator(".ctx .ctx-weight select").is_visible())
    pg.close()

    # Phone: compact row and the Text sheet.
    pg, e = fresh(br, 390, 844); errors += e
    if pg.locator(".sec-panel:visible").count(): pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    tap(pg, "[data-el='line']")
    vis = lambda s: pg.locator(f".editor-bar-ctx .ctx > {s}").first.is_visible()
    check("390px: the row shows Edit words, Aa, Bold, Italic and Underline", vis(".ctx-aa") and vis(".ctx-format") and pg.locator(".ctx [aria-label='Edit words']").first.is_visible())
    check("390px: Size and Weight move into the Text sheet", not vis(".ctx-size") and not vis(".ctx-weight"))
    pg.locator(".ctx .ctx-aa").click(); pg.wait_for_timeout(700)
    sheet = pg.locator(".ctx-sheet")
    check("390px: Aa opens the Text sheet", sheet.is_visible() and pg.locator(".ctx .ctx-aa").get_attribute("aria-expanded") == "true")
    check("390px: the sheet has Size, Weight, Colour and Text alignment", sheet.locator(".ctx-size").count() == 1 and sheet.locator(".ctx-weight select").count() == 1 and sheet.locator("[aria-label='Colour']").count() >= 1 and sheet.locator("[aria-label='Text alignment']").count() == 1)
    check("390px: the sheet links to Settings for this text", sheet.locator(".ctx-sheet-more").inner_text().strip() == "Settings for this text")
    sb = sheet.bounding_box()
    fr = pg.locator("#preview-frame").bounding_box()
    eb = frame(pg).locator("[data-el='line']").first.bounding_box()
    top = eb["y"]
    check("390px: the selected text stays in view above the sheet", top >= fr["y"] - 1 and top + min(eb["height"], 40) <= sb["y"], f"text at {top:.0f}, sheet at {sb['y']:.0f}")
    small = [b for b in sheet.locator("button, select").all() if b.is_visible() and (b.bounding_box()["height"] < 36)]
    check("390px: sheet controls are comfortable to tap (36px or more)", not small, str(len(small)))
    sheet.locator(".ctx-weight select").select_option("700"); pg.wait_for_timeout(600)
    check("390px: Weight in the sheet changes the text", frame(pg).locator("[data-el='line']").first.evaluate("e => getComputedStyle(e).fontWeight") == "700")
    bad = axe(pg)
    check("390px: axe finds no serious or critical problems with the sheet open", not bad, json.dumps(bad)[:300])
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("390px: Escape closes the sheet and keeps the selection", sheet.count() == 0 and pg.locator(".ctx-name").first.inner_text() == "Summary line")
    pg.locator(".ctx .ctx-aa").click(); pg.wait_for_timeout(500)
    pg.locator(".ctx-sheet .ctx-sheet-head button").click(); pg.wait_for_timeout(400)
    check("390px: Done closes the sheet", pg.locator(".ctx-sheet").count() == 0)
    pg.locator(".ctx .ctx-aa").click(); pg.wait_for_timeout(500)
    pg.locator(".ctx-sheet .ctx-sheet-more").click(); pg.wait_for_timeout(900)
    check("390px: Settings for this text opens Settings", pg.locator(".el-panel .el-name").count() >= 1 and pg.locator(".el-panel .el-name").first.is_visible())
    # Text lower on the page scrolls up above the sheet.
    tap(pg, "[data-el='value-tools']")
    frame(pg).evaluate("window.scrollBy(0, 300)"); pg.wait_for_timeout(300)
    pg.locator(".ctx .ctx-aa").click(); pg.wait_for_timeout(700)
    eb = frame(pg).locator("[data-el='value-tools']").first.bounding_box(); sb = pg.locator(".ctx-sheet").bounding_box(); fr = pg.locator("#preview-frame").bounding_box()
    check("390px: text lower down scrolls into view above the sheet", eb["y"] >= fr["y"] - 1 and eb["y"] + min(eb["height"], 40) <= sb["y"], f"text at {eb['y']:.0f}, sheet at {sb['y']:.0f}")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.screenshot(path="/tmp/text52-phone.png")
    tap(pg, "[data-el='title']")
    check("390px: on a title the greyed buttons stay in the row", pg.locator(".ctx .ctx-format.is-off").first.is_visible())
    pg.close()

    check("No script errors", not errors, str(errors[:3]))
    br.close()
print(f"{sum(res)} of {len(res)} passed")
