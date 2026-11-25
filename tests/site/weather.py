# Homepage weather beside the clock (approved 24 Nov 2026). Open-Meteo is never contacted: every
# request is answered by the test (page.route), so results do not depend on the real weather.
# Run against a built site:  python3 tests/site/weather.py [base url, default http://localhost:4330]
import os, sys, json, time
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4330"
AXE = next((p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p)), None)
SHOTS = os.environ.get("WX_SHOTS")  # folder for screenshots, optional
API = "https://api.open-meteo.com/**"
T0 = "2026-11-25T10:00:00Z"  # fake "now" for the timing tests
T0_S = 1795600800  # the same moment in seconds
passed = failed = 0
def check(name, ok, detail=""):
    global passed, failed
    passed += bool(ok); failed += not ok
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  [{detail}]"))

def reply(temp=7, code=2, wind=10, day=1, at=None):
    return json.dumps({"current": {"time": int(at if at is not None else time.time() - 300), "temperature_2m": temp, "weather_code": code, "wind_speed_10m": wind, "is_day": day}})

class Api:
    """Answers Open-Meteo requests in a context and counts them. mode: ok, 500, abort, hang, junk."""
    def __init__(self, ctx, mode="ok", **kw):
        self.count, self.urls, self.mode, self.kw, self.pending = 0, [], mode, kw, []
        ctx.route(API, self.handle)
    def handle(self, route):
        self.count += 1; self.urls.append(route.request.url)
        if self.mode == "ok": route.fulfill(status=200, content_type="application/json", body=reply(**self.kw))
        elif self.mode == "500": route.fulfill(status=500, body="error")
        elif self.mode == "abort": route.abort()
        elif self.mode == "junk": route.fulfill(status=200, content_type="application/json", body="{not json")
        elif self.mode == "empty": route.fulfill(status=200, content_type="application/json", body='{"current": {}}')
        else: self.pending.append(route)  # "hang": never answers, so the page's own 8 second limit has to end it

def open_home(br, width=1440, mode="ok", clock=None, storage=None, wait=True, **kw):
    ctx = br.new_context(viewport={"width": width, "height": 900}, storage_state=storage)
    api = Api(ctx, mode, **kw)
    if clock: ctx.clock.install(time=clock)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/", wait_until="load")
    if wait and mode == "ok": pg.wait_for_selector(".home-wx", timeout=5000)
    else: pg.wait_for_timeout(600)
    return ctx, pg, api, errs

def shown(pg): return pg.locator(".home-wx").count() == 1
def sr(pg): return pg.locator(".home-wx .visually-hidden").inner_text() if shown(pg) else None

LAYOUT = """() => { const q = s => document.querySelector(s)?.getBoundingClientRect(); const c = q('.home-clock');
  const fs = parseFloat(getComputedStyle(document.querySelector('.home-clock')).fontSize);
  const w = q('.home-wx'), ic = q('.home-wx-icon'), tp = document.querySelector('.home-wx > span[aria-hidden]')?.getBoundingClientRect();
  return { lines: Math.round(c.height / (fs * 1.07)), location: q('.home-clock-now > span:last-child').top, clockBottom: c.bottom,
    availability: q('.home-line').top, focus: q('.home-focus').top, work: q('.home-work').top,
    together: w ? Math.abs((ic.top + ic.bottom) / 2 - (tp.top + tp.bottom) / 2) < 6 && tp.left >= ic.right - 1 : null,
    sideways: document.documentElement.scrollWidth > innerWidth } }"""

with sync_playwright() as p:
    br = p.chromium.launch()

    # ---- 1. Conditions and icons (WMO code, wind km/h, day): expected icon and spoken words
    cases = [
        (95, 10, 1, "thunder", "thunderstorm"), (99, 55, 1, "thunder", "thunderstorm"),
        (71, 10, 1, "snow", "snow"), (86, 50, 0, "snow", "snow"),
        (61, 10, 1, "rain", "rain"), (81, 45, 1, "rain", "rain"), (56, 10, 1, "rain", "rain"),
        (45, 10, 1, "fog", "fog"), (48, 60, 1, "fog", "fog"),
        (3, 40, 1, "wind", "windy"), (0, 45, 0, "wind", "windy"), (3, 39.9, 1, "cloudy", "cloudy"),
        (2, 10, 1, "partly", "partly cloudy"), (0, 5, 1, "clear-day", "clear"), (1, 5, 0, "clear-night", "clear"),
    ]
    for code, wind, day, cond, words in cases:
        ctx, pg, api, errs = open_home(br, code=code, wind=wind, day=day)
        got = pg.locator(".home-wx-icon").get_attribute("data-condition")
        check(f"Code {code}, wind {wind} km/h, {'day' if day else 'night'}: {cond} icon, spoken as \"{words}\"", got == cond and sr(pg) == f"({words}, 7 degrees Celsius)", [got, sr(pg)])
        ctx.close()
    ctx, pg, api, errs = open_home(br, mode="ok", wait=False, code=4)
    pg.wait_for_timeout(1000)
    check("An unknown weather code shows no weather", api.count == 1 and not shown(pg), [api.count, shown(pg)]); ctx.close()

    # ---- 2. Temperature formatting
    for temp, text, spoken in [(-3.4, "−3°C", "-3"), (-0.4, "0°C", "0"), (0, "0°C", "0"), (7.5, "8°C", "8"), (12.49, "12°C", "12"), (-12.6, "−13°C", "-13")]:
        ctx, pg, api, errs = open_home(br, temp=temp)
        t = pg.locator(".home-wx > span[aria-hidden]").inner_text()
        check(f"{temp} shows as {text}", t == text and f", {spoken} degrees Celsius)" in sr(pg), [t, sr(pg)]); ctx.close()

    # ---- 3. Request: the clock's city, after the page has loaded, no referrer
    ctx, pg, api, errs = open_home(br)
    check("Asks Open-Meteo for Harrogate's coordinates", api.count == 1 and "latitude=53.9921" in api.urls[0] and "longitude=-1.5418" in api.urls[0], api.urls)
    # Screen readers: icon and printed temperature hidden, the words read instead.
    hidden = pg.evaluate("[document.querySelector('.home-wx-icon').getAttribute('aria-hidden'), document.querySelector('.home-wx > span[aria-hidden]').getAttribute('aria-hidden')]")
    check("Icon and printed temperature are hidden from screen readers", hidden == ["true", "true"], hidden)
    check("Screen readers hear \"(partly cloudy, 7 degrees Celsius)\"", sr(pg) == "(partly cloudy, 7 degrees Celsius)", sr(pg))
    snap = pg.locator(".home-clock").aria_snapshot()
    check("The clock reads as one sentence with the weather in words", "It is now" in snap and "partly cloudy, 7 degrees Celsius" in snap and "°" not in snap, snap)
    st = pg.evaluate("(() => { const i = getComputedStyle(document.querySelector('.home-wx-icon')), t = getComputedStyle(document.querySelector('.home-clock time')), w = document.querySelector('.home-wx-icon').getBoundingClientRect(); return [i.color, t.color, Math.round(w.height / parseFloat(t.fontSize) * 100) / 100] })()")
    check("Icon is the clock's grey (#6d6b55) and 0.8 times the text size", st[0] == st[1] == "rgb(109, 107, 85)" and st[2] == 0.8, st)
    a = pg.locator(".home-wx").bounding_box()
    pg.wait_for_timeout(1100)
    b = pg.locator(".home-wx").bounding_box()
    check("The ticking seconds never move the weather", a == b, [a, b])
    credit = pg.locator(".footer-credit a", has_text="Weather data by Open-Meteo.com")
    check("Footer credits Open-Meteo, linked", credit.count() == 1 and credit.get_attribute("href") == "https://open-meteo.com/", credit.count())
    check("No script errors", not errs, errs); ctx.close()

    # ---- 4. Layout: compared with the same page without weather. Widest likely reading: −22°C.
    for w in [1440, 1280, 1024, 960, 900, 390, 360]:
        c1, off, _, _ = open_home(br, width=w, mode="abort")
        c2, on, _, errs = open_home(br, width=w, temp=-22)
        x, y = off.evaluate(LAYOUT), on.evaluate(LAYOUT)
        size = on.evaluate("(() => { const c = getComputedStyle(document.querySelector('.home-clock')); return [c.fontSize, c.fontWeight] })()")
        expect = "44px" if w >= 1280 else "36px" if w >= 900 else "32px"
        check(f"{w} px: clock {expect}, weight 500, unchanged", size == [expect, "500"], size)
        check(f"{w} px: icon and temperature on one line together", y["together"], y)
        check(f"{w} px: no sideways scrolling", not y["sideways"])
        if w in (960, 900):
            # Approved: here the icon and temperature may move to their own line, together.
            check(f"{w} px: {y['lines']} lines (5 or 6 allowed); availability line, Areas of Focus and projects do not move",
                  y["lines"] in (5, 6) and all(abs(x[k] - y[k]) < 0.5 for k in ["availability", "focus", "work"]), [x, y])
        else:
            check(f"{w} px: five lines; location line, line under the clock, availability line and everything below do not move",
                  y["lines"] == 5 and all(abs(x[k] - y[k]) < 0.5 for k in ["location", "clockBottom", "availability", "focus", "work"]), [x, y])
        if SHOTS and w in (1440, 960, 390):
            c3, sh, _, _ = open_home(br, width=w)
            sh.screenshot(path=f"{SHOTS}/weather-{w}.png"); c3.close()
        c1.close(); c2.close()
    if SHOTS:
        c3, sh, _, _ = open_home(br, width=1024); sh.screenshot(path=f"{SHOTS}/weather-1024.png"); c3.close()

    # ---- 5. Failures: no weather, the clock carries on
    for mode, label in [("500", "Server error (HTTP 500)"), ("abort", "Network error"), ("junk", "Malformed JSON"), ("empty", "Answer without the expected fields")]:
        ctx, pg, api, errs = open_home(br, mode=mode)
        pg.wait_for_timeout(800)
        a = pg.locator(".home-clock time").inner_text(); pg.wait_for_timeout(1100); b = pg.locator(".home-clock time").inner_text()
        check(f"{label}: no weather, the clock keeps ticking, no script errors", api.count == 1 and not shown(pg) and a != b and not errs, [api.count, shown(pg), a, b, errs])
        ctx.close()
    ctx, pg, api, errs = open_home(br, mode="hang", clock=T0)
    pg.clock.run_for(9000)
    a = pg.locator(".home-clock time").inner_text(); pg.clock.run_for(2000); b = pg.locator(".home-clock time").inner_text()
    check("No answer within 8 seconds: no weather, the clock keeps ticking", api.count == 1 and not shown(pg) and a != b and not errs, [api.count, a, b, errs])
    pg.clock.run_for(5 * 60 * 1000); pg.wait_for_timeout(300)
    check("The unanswered request was given up, so it tries again 5 minutes later", api.count == 2, api.count)
    for r in api.pending:
        try: r.abort()
        except Exception: pass
    ctx.close()

    # ---- 6. Recovery: a failure, then a retry 5 minutes later succeeds
    ctx, pg, api, errs = open_home(br, mode="500", clock=T0)
    pg.clock.run_for(4 * 60 * 1000)
    check("After a failure, waits before asking again", api.count == 1, api.count)
    api.mode, api.kw = "ok", {"at": T0_S + 4 * 60}
    pg.clock.run_for(70 * 1000); pg.wait_for_timeout(300)
    check("Five minutes after a failure it asks again and the weather appears", api.count == 2 and shown(pg), [api.count, shown(pg)]); ctx.close()

    # ---- 7. Saved reading: 15 minutes fresh, never older than 45 minutes
    ctx, pg, api, errs = open_home(br, clock=T0, at=T0_S - 600)
    saved = ctx.storage_state(); ctx.close()
    ctx, pg, api, errs = open_home(br, clock="2026-11-25T10:10:00Z", storage=saved, mode="500", wait=False)
    check("Reload within 15 minutes: saved weather shown, no new request", api.count == 0 and shown(pg), [api.count, shown(pg)]); ctx.close()
    ctx, pg, api, errs = open_home(br, clock="2026-11-25T10:16:00Z", storage=saved, at=T0_S + 900)
    check("Reload after 15 minutes: asks again", api.count == 1 and shown(pg), [api.count, shown(pg)]); ctx.close()
    ctx, pg, api, errs = open_home(br, clock="2026-11-25T10:16:00Z", storage=saved, mode="500", wait=False)
    check("After 15 minutes with the service down: the saved reading (26 minutes old) is still shown", api.count == 1 and shown(pg), [api.count, shown(pg)]); ctx.close()
    ctx, pg, api, errs = open_home(br, clock="2026-11-25T10:36:00Z", storage=saved, mode="500", wait=False)
    check("Service down and the saved observation 46 minutes old: no weather", api.count == 1 and not shown(pg), [api.count, shown(pg)]); ctx.close()
    ctx, pg, api, errs = open_home(br, clock=T0, at=T0_S - 46 * 60, wait=False)
    check("Open-Meteo sends an observation 46 minutes old: not shown", api.count == 1 and not shown(pg), [api.count, shown(pg)]); ctx.close()
    ctx, pg, api, errs = open_home(br, clock=T0, at=T0_S - 40 * 60)
    api.mode = "500"
    pg.clock.run_for(6 * 60 * 1000); pg.wait_for_timeout(300)
    check("A shown reading disappears once it is over 45 minutes old and cannot be refreshed", not shown(pg), shown(pg)); ctx.close()

    # ---- 8. Refreshes only while the tab is visible
    HIDE = """window.__vis = 'visible'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
              Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis !== 'visible' });"""
    def set_vis(pg, v): pg.evaluate(f"window.__vis = '{v}'; document.dispatchEvent(new Event('visibilitychange'))")
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); api = Api(ctx, "ok", at=T0_S); ctx.clock.install(time=T0); ctx.add_init_script(HIDE)
    pg = ctx.new_page(); pg.goto(BASE + "/", wait_until="load"); pg.wait_for_selector(".home-wx")
    pg.clock.run_for(16 * 60 * 1000)
    check("Refreshes every 15 minutes while visible", api.count == 2, api.count)
    set_vis(pg, "hidden"); pg.clock.run_for(40 * 60 * 1000)
    check("No requests while the tab is hidden", api.count == 2, api.count)
    api.kw = {"at": T0_S + 56 * 60}; set_vis(pg, "visible"); pg.wait_for_timeout(300)
    check("Asks again as soon as the tab is shown", api.count == 3 and shown(pg), api.count); ctx.close()
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); api = Api(ctx, "ok"); ctx.add_init_script(HIDE.replace("window.__vis = 'visible'", "window.__vis = 'hidden'"))
    pg = ctx.new_page(); pg.goto(BASE + "/", wait_until="load"); pg.wait_for_timeout(800)
    a = api.count; set_vis(pg, "visible"); pg.wait_for_selector(".home-wx", timeout=5000)
    check("A page opened in a background tab waits until it is shown", a == 0 and api.count == 1, [a, api.count]); ctx.close()

    # ---- 9. Accessibility (axe) with the weather shown, desktop and phone
    if AXE:
        for w in [1440, 390]:
            ctx, pg, api, errs = open_home(br, width=w)
            pg.add_script_tag(path=AXE)
            bad = pg.evaluate("async () => (await axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']})).violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id)")
            check(f"axe at {w} px: no serious or critical problems with the weather shown", not bad, bad); ctx.close()
    else:
        check("axe-core found", False, "axe.min.js not found")
    br.close()

print(f"{passed} of {passed + failed} passed")
sys.exit(1 if failed else 0)
