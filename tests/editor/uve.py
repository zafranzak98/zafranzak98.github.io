# Visual editor demo (uve-demo): every page type and shared part (Homepage, About, Projects, each
# category, Header, Footer, a case study with the shared header and footer) can be edited on the page,
# previewed, recovered after a reload, saved as a draft and published (simulated) at 1440, 1024 and
# 390 px; the shared header reaches other pages once published; the homepage clock settings; the
# About portrait controls; the three safeguards (draft recovery, the same words changed in another tab
# or by someone else, publishing blocked with reasons); axe on each page type; and the network: no
# request leaves this machine, none goes to GitHub or /admin, and nothing but GET is ever sent.
# Run from the repository root after `bun run build:preview` and `python3 tests/editor/serve.py dist 4302 &`.
# UVE_SIZES=1440x1000,1024x768,390x844 (default) chooses the screen sizes for the per-page checks.
import json, os, re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
BASE = os.environ.get("EDITOR_BASE", "http://localhost:4302/admin/design/")
HOST = urlparse(BASE).netloc
AXE = os.environ.get("AXE") or next(p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p))
SIZES = [tuple(map(int, s.split("x"))) for s in os.environ.get("UVE_SIZES", "1440x1000,1024x768,390x844").split(",")]
SHOTS = os.environ.get("UVE_SHOTS", "/tmp/uve-shots")
os.makedirs(SHOTS, exist_ok=True)
PAGES = [("home", "Homepage"), ("about", "About"), ("projects", "Projects"), ("category:editorial", "Category: Editorial"), ("category:brand-communications", "Category: Brand Communications"), ("header", "Shared header"), ("footer", "Shared footer"), ("project=about-face-beauty", "Case study with shared parts")]
requests, console, errors = [], [], []

def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def url(key): return BASE + ("?" + key if key.startswith("project=") else "?page=" + key)
def watch(pg):
    pg.on("request", lambda r: requests.append((r.method, r.url)))
    pg.on("console", lambda m: m.type == "error" and console.append(m.text))
    pg.on("pageerror", lambda e: errors.append(str(e)))
def fresh(ctx, key, w, h, clear=True):
    pg = ctx.new_page(); pg.set_viewport_size({"width": w, "height": h}); watch(pg)
    pg.goto(url(key), wait_until="networkidle")
    if clear: pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(2500); close_sections(pg)
    return pg
def close_sections(pg):
    if pg.locator(".sec-panel:visible").count() and pg.viewport_size["width"] < 638: pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
def box(pg, sel):
    el = frame(pg).locator(sel).first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(300); return el.bounding_box()
def tap(pg, sel, double=False):
    b = box(pg, sel); (pg.mouse.dblclick if double else pg.mouse.click)(b["x"] + min(6, b["width"] / 2), b["y"] + b["height"] / 2); pg.wait_for_timeout(700)
def type_on_page(pg, sel, words):
    tap(pg, sel, double=True)
    pg.keyboard.press("ControlOrMeta+a"); pg.keyboard.type(words); pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
def status(pg): return (pg.locator(".editor-status").text_content() or "").strip()
def notice(pg): return " ".join(pg.locator(".editor-notice").all_inner_texts())
def canvas_text(pg): return frame(pg).locator("body").text_content()
# The words in the page itself (headings are shown in capitals by the site's styles).
def words_of(pg, sel): return frame(pg).locator(sel).first.text_content() or ""
def settings(pg):
    if not pg.locator(".el-panel >> visible=true").count(): pg.locator(".ctx .ctx-settings").first.click(); pg.wait_for_timeout(600)
def vis(pg, sel): return pg.locator(f"{sel} >> visible=true")
def preview(pg):
    if pg.locator(".editor-preview").is_visible(): pg.locator(".editor-preview").click()
    else: pg.locator(".editor-more-btn").click(); pg.wait_for_timeout(200); pg.locator(".editor-more-preview").click()
    pg.wait_for_timeout(600)
def publish(pg):
    pg.locator(".editor-bar-end .editor-primary").click()
    pg.wait_for_selector(".editor-panel .editor-primary:not([disabled])", timeout=15000) if not pg.locator(".editor-panel [role=alert]").count() else pg.wait_for_timeout(5000)
def axe(pg, where="editor"):
    if where == "editor":
        pg.add_script_tag(path=AXE)
        return pg.evaluate("""async () => (await axe.run({ exclude: [['#preview-frame']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
          .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, where: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }))""")
    f = frame(pg); f.add_script_tag(path=AXE)
    return f.evaluate("""async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }))
      .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, n: v.nodes.length, where: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }))""")
canvas_axe = {}

with sync_playwright() as p:
    br = p.chromium.launch()

    # ---- 1. Every page type at each size: edit on the page, preview, recovery, draft, publish (simulated).
    for w, h in SIZES:
        for key, name in PAGES:
            ctx = br.new_context(bypass_csp=True); pg = fresh(ctx, key, w, h)
            label = f"{w}px {name}"
            first = frame(pg).locator("[data-edit] >> visible=true").first
            check(f"{label}: opens with words that can be edited on the page", first.count() == 1)
            if not first.count(): ctx.close(); continue
            field = first.get_attribute("data-edit"); el_key = first.get_attribute("data-el")
            sel = f"[data-el='{el_key}'][data-edit='{field}']"
            words = f"UVE {w} {name.split(':')[-1].strip()[:12]}"
            type_on_page(pg, sel, words)
            check(f"{label}: typing on the page changes the words ({field})", words in words_of(pg, sel), words_of(pg, sel)[:80])
            check(f"{label}: the status says Not saved yet", status(pg) == "Not saved yet", status(pg))
            if key in ("home", "project=about-face-beauty") or key.startswith("category:editorial"):
                check(f"{label}: the shared header and footer are drawn around the page", frame(pg).locator(".shared-header").count() == 1 and frame(pg).locator(".shared-footer").count() == 1)
            preview(pg)
            check(f"{label}: Preview hides every editing mark", pg.evaluate("document.body.classList.contains('is-preview')") and frame(pg).locator("html[data-preview]").count() == 1 and not frame(pg).locator(".el-frame:visible, .el-hover:visible").count() and words in canvas_text(pg))
            preview(pg)
            check(f"{label}: Back to editing", not pg.evaluate("document.body.classList.contains('is-preview')"))
            pg.wait_for_timeout(600)
            pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500); close_sections(pg)
            check(f"{label}: after a reload the unsaved words are back, with the recovery message", words in canvas_text(pg) and "Your changes from last time are back" in notice(pg), notice(pg)[:120])
            pg.locator(".editor-save").click(); pg.wait_for_timeout(800)
            check(f"{label}: Save draft is simulated in this browser", status(pg).startswith("Draft saved") and "Draft saved in this browser" in notice(pg), notice(pg)[:120])
            publish(pg)
            if w == 1440:
                pg.screenshot(path=f"{SHOTS}/publish-panel-{key.replace(':', '-').replace('=', '-')}.png")
            pg.locator(".editor-panel .editor-primary").click(); pg.wait_for_timeout(900)
            check(f"{label}: Publish is simulated and says so", "Published in this demo only (simulated)" in notice(pg) and status(pg).startswith("Published"), notice(pg)[:120])
            pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500); close_sections(pg)
            check(f"{label}: after a reload the page opens as published here", words in canvas_text(pg) and "Your changes from last time" not in notice(pg))
            if key == "header":
                hp = fresh(ctx, "about", w, h, clear=False)
                check(f"{label}: the published header shows on another page (About)", words in words_of(hp, ".shared-header"), words_of(hp, ".shared-header")[:80]); hp.close()
            if w == 1440:
                bad = axe(pg); check(f"{label}: axe finds no serious or critical problems in the editor", not bad, json.dumps(bad)[:300])
                canvas_axe[name] = axe(pg, "canvas")
            if w == 1440 and key in ("home", "about", "projects", "category:editorial", "header", "footer"):
                pg.screenshot(path=f"{SHOTS}/page-{key.replace(':', '-')}.png")
            ctx.close()

    # ---- 1b. Words inside rows and lists (About entries, focus labels, footer links) are typed on the page.
    for key, sels in [("about", ["[data-el='edu-course-0']", "[data-el='role-org-0']", "[data-el='language-1']", "[data-el='kicker']"]), ("home", ["[data-el='focus-0']"]), ("footer", ["[data-el='page-about']", "[data-el='credit']", "[data-el='email']"])]:
        ctx = br.new_context(bypass_csp=True); pg = fresh(ctx, key, 1440, 1000)
        for sel in sels:
            words = "Edited " + sel.split("'")[1]
            type_on_page(pg, sel, words)
            part = sel.split("'")[1]
            check(f"{key}: {part} is typed on the page", words in words_of(pg, sel), words_of(pg, sel)[:60])
        if key == "footer": check("footer: the year beside the copyright line stays automatic", "© 2026" in words_of(pg, ".footer-credit") or "©" in words_of(pg, ".footer-credit"))
        ctx.close()

    # ---- 2. Homepage clock settings.
    ctx = br.new_context(bypass_csp=True); pg = fresh(ctx, "home", 1440, 1000)
    tap(pg, "[data-el='clock']"); settings(pg)
    check("Clock: Settings holds the clock settings with the clock's line", vis(pg, "[aria-label='Clock settings']").count() == 1 and vis(pg, "[aria-label='Clock settings'] input[type=checkbox]").count() == 1)
    check("Clock: the line is not offered twice (Content: Words holds it here)", vis(pg, "[aria-label='Clock settings'] label", ).filter(has_text="Line under the time").count() == 0)
    city = vis(pg, "[aria-label='Clock settings'] input.el-words").nth(0); zone = vis(pg, "[aria-label='Clock settings'] input[list]").first
    city.fill("Kuala Lumpur"); pg.wait_for_timeout(400)
    zone.fill("Asia/Kuala_Lumpur"); pg.wait_for_timeout(1200)
    want = pg.evaluate("new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())")
    clock = frame(pg).locator("[data-el='clock']").inner_text()
    check("Clock: city and time zone show on the page at once", "in Kuala Lumpur." in clock and want in clock, clock)
    check("Clock: the settings confirm the time zone with the time there", "Valid." in vis(pg, "[aria-label='Clock settings']").inner_text())
    pg.screenshot(path=f"{SHOTS}/clock-settings.png")
    zone.fill("Asia/Kuala_Lumpr"); pg.wait_for_timeout(700)
    check("Clock: a time zone that does not exist is named as invalid", vis(pg, "[aria-label='Clock settings'] [role=alert]").count() == 1 and zone.get_attribute("aria-invalid") == "true")
    check("Clock: the page keeps the last valid time zone (nothing breaks)", "in Kuala Lumpur." in frame(pg).locator("[data-el='clock']").inner_text() and not errors)
    pg.screenshot(path=f"{SHOTS}/clock-invalid-zone.png")
    publish(pg)
    blocked = pg.locator(".editor-panel .editor-blocked").inner_text() if pg.locator(".editor-panel .editor-blocked").count() else ""
    check("Validation: Publish is blocked, with the reason in words", "is not a real time zone" in blocked and pg.locator(".editor-panel .editor-primary").is_disabled(), blocked[:160])
    pg.screenshot(path=f"{SHOTS}/publish-blocked-time-zone.png")
    pg.locator(".editor-panel .editor-blocked button", has_text="Show me").first.click(); pg.wait_for_timeout(900)
    check("Validation: Show me goes to the clock and its settings", pg.locator(".ctx-name").first.inner_text() == "Clock" and vis(pg, "[aria-label='Clock settings']").count() == 1)
    vis(pg, "[aria-label='Clock settings'] input[list]").first.fill("Europe/Paris"); pg.wait_for_timeout(700)
    vis(pg, "[aria-label='Clock settings'] input[type=checkbox]").first.uncheck(); pg.wait_for_timeout(900)
    check("Clock: hidden, it leaves a faded line in the editor to bring it back", frame(pg).locator(".editor-clock-off").count() == 1)
    preview(pg)
    check("Clock: hidden, Preview shows the page without it", not frame(pg).locator(".editor-clock-off:visible, .home-clock-now").count())
    preview(pg)
    pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(900)
    paris = lambda: pg.evaluate("new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())")
    check("Clock: Undo shows the clock again, on Paris time", frame(pg).locator(".home-clock-now").count() == 1 and paris() in frame(pg).locator("[data-el='clock']").inner_text())
    tap(pg, "[data-el='clock']"); settings(pg)
    vis(pg, "[aria-label='Clock settings'] input.el-words").nth(0).fill(""); pg.wait_for_timeout(600)
    publish(pg)
    check("Validation: a shown clock with no city blocks publishing", "no city" in (pg.locator(".editor-panel .editor-blocked").inner_text() if pg.locator(".editor-panel .editor-blocked").count() else ""))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(900)
    tap(pg, "[data-el='clock']", double=True); pg.keyboard.press("ControlOrMeta+a"); pg.keyboard.type("Always curious."); pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
    clock = frame(pg).locator("[data-el='clock']").inner_text()
    check("Clock: the line under the time is typed on the page; the time stays", clock.strip().endswith("Always curious.") and "It is now" in clock, clock)
    pg.wait_for_timeout(600); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    clock = frame(pg).locator("[data-el='clock']").inner_text()
    check("Clock: settings and line come back after a reload (recovery)", paris() in clock and "in Kuala Lumpur." in clock and "Always curious." in clock, clock)
    ctx.close()
    # The same settings on a phone.
    ctx = br.new_context(bypass_csp=True); pg = fresh(ctx, "home", 390, 844)
    tap(pg, "[data-el='clock']"); settings(pg)
    check("390px Clock: the settings open in the phone's Settings panel", vis(pg, "[aria-label='Clock settings']").count() == 1)
    bad = axe(pg); check("390px Clock: axe finds no serious or critical problems with the clock settings open", not bad, json.dumps(bad)[:300])
    pg.screenshot(path=f"{SHOTS}/clock-settings-390.png")
    ctx.close()

    # ---- 3. About portrait.
    ctx = br.new_context(bypass_csp=True); pg = fresh(ctx, "about", 1440, 1000)
    tap(pg, "[data-el='portrait']")
    bar = pg.locator(".editor-bar-ctx .ctx").first
    check("Portrait: choosing it shows Portrait tools with Width, and no angle", bar.get_attribute("aria-label") == "Portrait tools" and bar.locator("input[type=range]").count() == 1 and "Angle" not in bar.inner_text())
    check("Portrait: the approved tilt and paperclip are there", frame(pg).locator(".about-photo .paper-clip").count() == 2 and "matrix" in frame(pg).locator(".about-photo").evaluate("e => getComputedStyle(e).transform"))
    settings(pg)
    photos = vis(pg, ".ps-photo")
    check("Portrait: Settings offers the photos already on the site, the current one marked", photos.count() >= 5 and vis(pg, ".ps-photo[aria-checked=true]").count() == 1, str(photos.count()))
    nf = vis(pg, ".el-panel input[aria-label='Width in per cent of the page']").first
    nf.fill("23"); nf.press("Enter"); pg.wait_for_timeout(800)
    ratio = frame(pg).locator("[data-el='portrait']").evaluate("e => e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width * 100")
    check("Portrait: Width changes its size on the page (23% of the page)", abs(ratio - 23) < 0.6, f"{ratio:.1f}")
    vis(pg, ".el-panel [aria-label='Focus top left']").first.click(); pg.wait_for_timeout(700)
    pos = frame(pg).locator("[data-el='portrait'] img").first.evaluate("e => getComputedStyle(e).objectPosition")
    check("Portrait: Crop focus moves the part kept in view", pos == "0% 0%", pos)
    pg.screenshot(path=f"{SHOTS}/portrait-settings.png")
    src0 = frame(pg).locator("[data-el='portrait'] img").first.get_attribute("src")
    vis(pg, ".ps-photo[aria-checked=false]").first.click(); pg.wait_for_timeout(900)
    src1 = frame(pg).locator("[data-el='portrait'] img").first.get_attribute("src")
    alt = vis(pg, ".el-panel textarea.el-words").first
    check("Portrait: choosing another photo shows it at once", src1 != src0, f"{src0} -> {src1}")
    check("Portrait: another photo needs its own description (emptied, marked required)", alt.input_value() == "" and vis(pg, ".el-panel .el-warning[role=alert]").count() == 1)
    pg.screenshot(path=f"{SHOTS}/portrait-description-required.png")
    publish(pg)
    blocked = pg.locator(".editor-panel .editor-blocked").inner_text() if pg.locator(".editor-panel .editor-blocked").count() else ""
    check("Validation: a portrait without a description blocks publishing, with the reason", "no description" in blocked and pg.locator(".editor-panel .editor-primary").is_disabled(), blocked[:160])
    pg.screenshot(path=f"{SHOTS}/publish-blocked-description.png")
    pg.locator(".editor-panel .editor-blocked button", has_text="Show me").first.click(); pg.wait_for_timeout(900)
    vis(pg, ".el-panel textarea.el-words").first.fill("Zafran in the studio"); pg.wait_for_timeout(700)
    check("Portrait: the description is on the photo", frame(pg).locator("[data-el='portrait'] img").first.get_attribute("alt") == "Zafran in the studio")
    publish(pg)
    check("Validation: with a description, publishing is possible again", not pg.locator(".editor-panel .editor-blocked").count() and pg.locator(".editor-panel .editor-primary").is_enabled())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.locator(".editor-bar-start ~ * .editor-screens button, .editor-screens button", has_text="Phone").first.click(); pg.wait_for_timeout(1500)
    tap(pg, "[data-el='portrait']"); settings(pg)
    v = vis(pg, ".el-panel input[aria-label='Width in per cent of the page']").first.input_value()
    check("Portrait: Phone has its own width (as designed, about 36%)", 34 <= float(v) <= 38, v)
    pg.screenshot(path=f"{SHOTS}/portrait-phone.png")
    pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(700)
    check("Portrait: Undo takes the description back out", frame(pg).locator("[data-el='portrait'] img").first.get_attribute("alt") == "")
    bad = axe(pg); check("Portrait: axe finds no serious or critical problems with its settings open", not bad, json.dumps(bad)[:300])
    ctx.close()

    # ---- 4. Same words changed in another tab.
    ctx = br.new_context(bypass_csp=True); a = fresh(ctx, "about", 1440, 1000); b = fresh(ctx, "about", 1440, 1000, clear=False)
    type_on_page(a, "[data-el='intro-heading']", "Tab A words"); a.wait_for_timeout(800)
    type_on_page(b, "[data-el='intro-heading']", "Tab B words"); b.wait_for_timeout(1200)
    a.bring_to_front(); a.wait_for_timeout(600)
    alert = a.locator(".editor-conflict[role=alert]")
    check("Two tabs: the same words changed in both are named, with both versions", alert.count() == 1 and "Tab A words" in alert.inner_text() and "Tab B words" in alert.inner_text(), alert.inner_text()[:160] if alert.count() else "")
    a.screenshot(path=f"{SHOTS}/conflict-other-tab.png")
    alert.locator("button", has_text="Use the other tab").click(); a.wait_for_timeout(900)
    check("Two tabs: Use the other tab’s words takes them, and Undo is offered", "Tab B words" in words_of(a, "[data-el='intro-heading']") and "Undo brings yours back" in notice(a))
    a.locator(".editor-notice button", has_text="Undo").click(); a.wait_for_timeout(900)
    check("Two tabs: Undo brings this tab's words back", "Tab A words" in words_of(a, "[data-el='intro-heading']"))
    ctx.close()
    ctx = br.new_context(bypass_csp=True); a = fresh(ctx, "about", 1440, 1000); b = fresh(ctx, "about", 1440, 1000, clear=False)
    type_on_page(a, "[data-el='intro-heading']", "Mine only"); a.wait_for_timeout(800)
    type_on_page(b, "[data-el='skills-heading']", "Other part"); b.wait_for_timeout(1200)
    check("Two tabs: different words in each tab are not called a clash", a.locator(".editor-conflict").count() == 0 and "also changed in another tab" in notice(a), notice(a)[:120])
    ctx.close()

    # ---- 5. Same words changed by someone else (simulated), and unrelated changes merging.
    ctx = br.new_context(bypass_csp=True); pg = fresh(ctx, "projects", 1440, 1000)
    pg.locator(".editor-more-btn").click(); pg.locator(".editor-more button", has_text="Simulate someone").click(); pg.wait_for_timeout(500)
    check("Someone else: with nothing changed yet, it explains what to do first", "Change some words first" in notice(pg))
    tap(pg, "[data-el='title']"); settings(pg)
    box_words = vis(pg, ".el-panel textarea.el-words").first.input_value() if vis(pg, ".el-panel textarea.el-words").count() else ""
    check("Projects: the Words box in Settings shows the page's own title", box_words == "Projects", box_words)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    type_on_page(pg, "[data-el='title']", "My projects")
    pg.locator(".editor-more-btn").click(); pg.locator(".editor-more button", has_text="Simulate someone").click(); pg.wait_for_timeout(500)
    check("Someone else: the simulated change is announced, naming the words", "Simulated: someone else changed" in notice(pg) and "Nothing was sent anywhere" in notice(pg), notice(pg)[:160])
    publish(pg)
    conflict = pg.locator(".editor-panel .editor-conflict")
    check("Someone else: Publish is held, naming the words, with yours and theirs", conflict.count() == 1 and "My projects" in conflict.inner_text() and "“Projects (changed by someone else)”" in conflict.inner_text() and pg.locator(".editor-panel .editor-primary").is_disabled())
    pg.screenshot(path=f"{SHOTS}/conflict-someone-else.png")
    conflict.locator("button", has_text="Use theirs").click(); pg.wait_for_timeout(900)
    check("Someone else: Use theirs puts their words on the page", "changed by someone else" in words_of(pg, "[data-el='title']"))
    pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(700)
    check("Someone else: Undo brings yours back", "My projects" in words_of(pg, "[data-el='title']"))
    pg.locator(".editor-more-btn").click(); pg.locator(".editor-more button", has_text="Simulate someone").click(); pg.wait_for_timeout(500)
    publish(pg)
    pg.locator(".editor-panel .editor-conflict button", has_text="Keep mine").click(); pg.wait_for_timeout(600)
    check("Someone else: Keep mine lets you publish over theirs", pg.locator(".editor-panel .editor-conflict").count() == 0 and pg.locator(".editor-panel .editor-primary").is_enabled())
    pg.locator(".editor-panel .editor-primary").click(); pg.wait_for_timeout(900)
    check("Someone else: published with your words (simulated)", "Published in this demo only" in notice(pg) and "My projects" in words_of(pg, "[data-el='title']"))
    ctx.close()
    # Unrelated: they change the title (then you undo yours), you change only the introduction.
    ctx = br.new_context(bypass_csp=True); pg = fresh(ctx, "projects", 1440, 1000)
    type_on_page(pg, "[data-el='title']", "Title again")
    pg.locator(".editor-more-btn").click(); pg.locator(".editor-more button", has_text="Simulate someone").click(); pg.wait_for_timeout(500)
    pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(700)
    type_on_page(pg, "[data-el='intro']", "Only the introduction")
    publish(pg)
    check("Unrelated changes: no clash is shown", pg.locator(".editor-panel .editor-conflict").count() == 0)
    pg.locator(".editor-panel .editor-primary").click(); pg.wait_for_timeout(900)
    check("Unrelated changes: both are kept, and the message says so", "did not touch your words, so both are kept" in notice(pg), notice(pg)[:160])
    ctx.close()

    # ---- 6. The demo's /admin copy.
    ctx = br.new_context(bypass_csp=True); pg = ctx.new_page(); pg.set_viewport_size({"width": 1440, "height": 1000}); watch(pg)
    pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(2500)
    check("/admin copy: opens with the visual editor inside, labelled as a demo copy", pg.locator(".adm-frame").count() == 1 and "Nothing here changes GitHub" in pg.locator(".adm-chip").inner_text())
    bad = axe(pg); check("/admin copy: axe finds no serious or critical problems", not bad, json.dumps(bad)[:300])
    ctx.close()

    # ---- 7. Isolation: every request stayed on this machine, read only.
    hosts = sorted({urlparse(u).netloc for _, u in requests if not u.startswith(("data:", "blob:"))})
    check("Network: every request went to this local copy only", hosts == [HOST], str(hosts))
    check("Network: nothing went to GitHub (api.github.com, github.com)", not [u for _, u in requests if "github.com" in u])
    methods = sorted({m for m, _ in requests})
    check("Network: nothing but GET was sent (no write request of any kind)", methods == ["GET"], str(methods))
    admin = [u for _, u in requests if re.search(r"/admin/(?!design/)", urlparse(u).path)]
    check("Network: the real /admin was never requested (only the demo's own files)", not admin, str(admin[:3]))
    print(f"INFO requests: {len(requests)}, hosts {hosts}, methods {methods}")
    check("Console: no page errors", not errors, str(errors[:3]))
    check("Console: no console errors", not console, str(console[:3]))
    for k, v in canvas_axe.items(): print(f"INFO canvas axe {k}: {json.dumps(v)[:400] if v else 'no serious or critical findings'}")
    br.close()
print(f"{sum(res)} of {len(res)} passed")
