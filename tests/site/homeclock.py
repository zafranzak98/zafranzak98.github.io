# Homepage clock, availability line and CV links (approved Option C, 24 Nov 2026).
# Run against a built site:  python3 tests/site/homeclock.py [base url, default http://localhost:4320]
import os, sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4320"
AXE = next((p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p)), None)
passed = failed = 0
def check(name, ok, detail=""):
    global passed, failed
    passed += bool(ok); failed += not ok
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  [{detail}]"))

with sync_playwright() as p:
    br = p.chromium.launch()
    # Daylight saving: the same instant shows 13:00 in winter (GMT) and 14:00 in summer (BST) for Europe/London.
    for when, expect in [("2026-01-15T13:00:00Z", "13:00:0"), ("2026-07-15T13:00:00Z", "14:00:0")]:
        pg = br.new_page(viewport={"width": 1440, "height": 900})
        pg.clock.install(time=when); pg.goto(BASE + "/", wait_until="networkidle"); pg.clock.run_for(1500)
        t = pg.locator(".home-clock time").inner_text()
        check(f"Europe/London at {when[:10]} 13:00 UTC shows {expect}x", t.startswith(expect), t); pg.close()
    # Keeps running correctly: after 61 seconds of running, the clock still matches the real time.
    pg = br.new_page(viewport={"width": 1440, "height": 900})
    pg.clock.install(time="2026-03-29T00:59:30Z"); pg.goto(BASE + "/", wait_until="networkidle"); pg.clock.run_for(61000)
    t = pg.locator(".home-clock time").inner_text()
    check("After 61 seconds of running it shows the right time, across the March clock change (02:00:31 BST)", t == "02:00:31", t); pg.close()
    # Another city and time zone, as if changed in /admin: the build reads them from Site settings.
    if os.environ.get("CLOCK_TZ_CHECK"):
        pg = br.new_page(viewport={"width": 1440, "height": 900})
        pg.clock.install(time="2026-07-15T13:00:00Z"); pg.goto(BASE + "/", wait_until="networkidle"); pg.clock.run_for(1500)
        txt = pg.locator(".home-clock").inner_text().replace("\n", " ")
        check("Kuala Lumpur setting shows 21:00 and the city name", "21:00:0" in txt and "in Kuala Lumpur." in txt, txt); pg.close()
    pg = br.new_page(viewport={"width": 1440, "height": 900}, bypass_csp=True); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE + "/", wait_until="networkidle")
    a = pg.locator(".home-clock time").inner_text(); pg.wait_for_timeout(2100); b = pg.locator(".home-clock time").inner_text()
    check("The seconds keep ticking", a != b, f"{a} {b}")
    text = pg.locator(".home-clock").inner_text().replace("\n", " ")
    check("Wording: It is now [time] in Harrogate. A mind full of ideas, always.", text.startswith("It is now ") and text.endswith("in Harrogate. A mind full of ideas, always."), text)
    st = pg.evaluate("(() => { const c = getComputedStyle(document.querySelector('.home-clock')); return [c.fontSize, c.fontWeight] })()")
    check("Desktop size 44 px, weight as approved (500)", st == ["44px", "500"], st)
    line = pg.locator(".home-line").inner_text().replace("\n", " ")
    check("Availability line and CV links", "Open to junior roles across the UK" in line and "View CV (PDF)" in line and "Download" in line, line)
    hrefs = pg.evaluate("[...document.querySelectorAll('.home-line a')].map(a => [a.getAttribute('href'), a.hasAttribute('download')])")
    check("View opens the PDF; Download downloads it", hrefs == [["/files/zafran-zakaria-cv.pdf", False], ["/files/zafran-zakaria-cv.pdf", True]], hrefs)
    r = pg.request.get(BASE + "/files/zafran-zakaria-cv.pdf")
    check("The CV PDF is served", r.ok and r.headers.get("content-type", "").startswith("application/pdf") and r.body()[:5] == b"%PDF-", r.status)
    check("The CV has no mobile number", b"7311" not in r.body())
    check("Header shows the CV link", pg.locator(".nav-desktop a", has_text="CV").count() == 1)
    box = pg.evaluate("(() => { const c = document.querySelector('.home-clock').getBoundingClientRect(), i = document.querySelector('.home-intro').getBoundingClientRect(); return [Math.round(c.top - i.top), c.left > i.right] })()")
    check("Clock sits beside the intro, top-aligned, in the right-hand space", abs(box[0]) <= 2 and box[1], box)
    if AXE:
        pg.add_script_tag(path=AXE)
        bad = pg.evaluate("async () => (await axe.run(document.querySelector('main'), {runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']})).violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id)")
        check("axe: no serious or critical problems on the homepage", not bad, bad)
    pg.keyboard.press("Tab")
    focus = []
    for _ in range(30):
        focus.append(pg.evaluate("document.activeElement.innerText")); pg.keyboard.press("Tab")
    check("Keyboard reaches View CV and Download", "View CV (PDF)" in focus and "Download" in focus, focus)
    check("No script errors", not errors, errors); pg.close()
    for w, h, size in [(1024, 768, "36px"), (900, 1000, "36px"), (899, 1000, "32px"), (390, 844, "32px"), (360, 740, "32px")]:
        pg = br.new_page(viewport={"width": w, "height": h}); pg.goto(BASE + "/", wait_until="networkidle")
        fs = pg.evaluate("getComputedStyle(document.querySelector('.home-clock')).fontSize")
        over = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        check(f"{w} px: clock {size}, no sideways scrolling", fs == size and over <= 0, [fs, over]); pg.close()
    pg = br.new_page(viewport={"width": 390, "height": 844}); pg.goto(BASE + "/", wait_until="networkidle")
    order = pg.evaluate("['.home-intro','.home-clock','.home-line','.home-focus'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().top))")
    check("Phone order: intro, clock, availability and CV, then Areas of Focus", order == sorted(order), order); pg.close()
    br.close()
print(f"{passed} of {passed + failed} passed")
