# Saving and recovery with the real save path: GitHub is answered by this test (no real sign-in or
# save), so lost connections, slow and failed saves, repeated clicks, reloads and closing the tab can
# be tried safely. Run from the repository root after `bun run build` and
# `python3 tests/editor/serve.py dist 4302 &`.
import json, time
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""))
URL = "http://zafranzak98.github.io:4302/admin/design/?project=about-face-beauty"
TOK = "ghu_" + "A" * 36
ENTRY = json.dumps({"backendName": "github", "id": 1, "login": "zafranzak98", "token": TOK, "refreshToken": "ghr_" + "R" * 60})
mode = {"put": "ok", "delay": 0, "patch": "ok", "hold": False}
held = []
# An earlier published version (the standard layout as saved on 22 Nov), offered in Versions for check 13.
import base64, os
VERSION = {"on": False, "b64": base64.b64encode(open(os.path.join(os.path.dirname(__file__), "fixtures", "about-face-beauty-version.json"), "rb").read()).decode()}
calls = []
def api(route):
    req = route.request; path = req.url.split("api.github.com")[1]; method = req.method
    calls.append((method, path.split("?")[0]))
    if path == "/user": return route.fulfill(status=200, json={"login": "zafranzak98"})
    repo = path.split("/repos/zafranzak98/zafranzak98.github.io")[-1]
    if method == "GET" and repo.startswith("/branches/"): return route.fulfill(status=200, json={"name": "design-drafts"})
    if method == "GET" and repo.startswith("/commits"):
        if "sha=main" in path and VERSION["on"]: return route.fulfill(status=200, json=[{"sha": "v1", "commit": {"message": "Design editor: publish layout for about-face-beauty", "author": {"date": "2026-11-22T23:18:00Z"}}}])
        return route.fulfill(status=200, json=[])
    if method == "GET" and repo.startswith("/contents/") and "ref=v1" in path:
        return route.fulfill(status=200, json={"sha": "f1", "encoding": "base64", "content": VERSION["b64"]})
    if method == "GET" and repo.startswith("/contents/"): return route.fulfill(status=404, json={"message": "Not Found"})
    if method == "PUT" and repo.startswith("/contents/"):
        if mode["hold"]: held.append(route); return
        if mode["put"] == "abort": return route.abort("internetdisconnected")
        if mode["put"] == "500": return route.fulfill(status=500, json={"message": "Server Error"})
        return route.fulfill(status=200, json={"content": {"sha": "s1"}})
    if repo == "/git/ref/heads/main": return route.fulfill(status=200, json={"object": {"sha": "base"}})
    if repo == "/git/commits/base": return route.fulfill(status=200, json={"tree": {"sha": "t0"}})
    if repo == "/git/trees": return route.fulfill(status=201, json={"sha": "t1"})
    if repo == "/git/commits": return route.fulfill(status=201, json={"sha": "c1"})
    if method == "PATCH":
        if mode["patch"] == "abort": return route.abort("internetdisconnected")
        if mode["patch"] == "422": return route.fulfill(status=422, json={"message": "Update is not a fast forward"})
        return route.fulfill(status=200, json={"object": {"sha": "c1"}})
    return route.fulfill(status=404, json={"message": "Not Found"})

with sync_playwright() as p:
    b = p.chromium.launch(args=["--host-resolver-rules=MAP zafranzak98.github.io 127.0.0.1"])
    errors = []
    def fresh(clear=True):
        ctx = b.new_context(viewport={"width": 1440, "height": 900}); ctx.route("https://api.github.com/**", api)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(URL)
        if clear: pg.evaluate("e => { localStorage.clear(); localStorage.setItem('sveltia-cms.user', e) }", ENTRY)
        pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
        return ctx, pg
    frame = lambda pg: [f for f in pg.frames if f != pg.main_frame][0]
    status = lambda pg: pg.locator(".editor-status").inner_text()
    notice = lambda pg: " ".join(pg.locator(".editor-notice p").all_inner_texts())
    def change(pg, wait=600):
        f = frame(pg); el = f.locator("[data-el='line']").first; el.scroll_into_view_if_needed(); bx = el.bounding_box()
        pg.mouse.click(bx["x"] + 6, bx["y"] + bx["height"] / 2); pg.wait_for_timeout(300)
        pg.locator(".ctx button[aria-label='Bold']").click(); pg.wait_for_timeout(wait)
    unsaved_copy = lambda pg: pg.evaluate("localStorage.getItem('design-editor:about-face-beauty:unsaved')")
    puts = lambda: len([c for c in calls if c[0] == "PUT"])

    # 1. A slow save: Saving… is shown, buttons wait, a second click sends nothing, success only when GitHub confirms.
    ctx, pg = fresh(); change(pg)
    check("A change is marked Not saved yet", status(pg) == "Not saved yet")
    mode.update(put="ok", hold=True); before = puts()
    pg.locator(".editor-save").click(); pg.wait_for_timeout(800)
    check("While saving the status says so, and nothing is claimed yet", status(pg).startswith("Saving the draft"), status(pg))
    check("Save and Publish wait while it saves", pg.locator(".editor-save").is_disabled() and pg.locator(".editor-primary").is_disabled())
    pg.locator(".editor-save").click(force=True); pg.wait_for_timeout(500)
    check("A second click during a save sends nothing more", puts() - before == 1, str(puts() - before))
    mode.update(hold=False)
    for r in held: r.fulfill(status=200, json={"content": {"sha": "s1"}})
    held.clear(); pg.wait_for_timeout(800)
    check("Draft saved only after GitHub confirms", status(pg).startswith("Draft saved "), status(pg))
    before = puts(); pg.locator(".editor-save").click(); pg.wait_for_timeout(600)
    check("Saving again with nothing changed sends nothing and says so", puts() == before and "Already saved" in notice(pg), notice(pg)[:80])
    # Reload: the saved draft is still shown as saved, not as unsaved.
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    check("After a reload a saved draft still shows as saved", status(pg).startswith("Draft saved "), status(pg))
    ctx.close()

    # 2. Lost connection during a save: nothing claimed, work kept, saving again works.
    ctx, pg = fresh(); change(pg)
    mode.update(put="abort"); pg.locator(".editor-save").click(); pg.wait_for_timeout(1200)
    check("Lost connection: the status says not saved", status(pg) == "Not saved: see the message", status(pg))
    check("The message says the connection was lost and work is kept", "connection to GitHub was lost" in notice(pg) and "kept in this browser" in notice(pg), notice(pg)[:120])
    check("The unsaved copy is still in this browser", unsaved_copy(pg) is not None)
    mode.update(put="ok"); pg.locator(".editor-save").click(); pg.wait_for_timeout(1200)
    check("Saving again once back works", status(pg).startswith("Draft saved "), status(pg))
    ctx.close()

    # 3. GitHub refuses (server error): nothing claimed.
    ctx, pg = fresh(); change(pg)
    mode.update(put="500"); pg.locator(".editor-save").click(); pg.wait_for_timeout(1200)
    check("A GitHub error is shown as not saved, with the reason", status(pg) == "Not saved: see the message" and "500" in notice(pg), notice(pg)[:100])
    mode.update(put="ok"); ctx.close()

    # 4. Going offline is shown; work is kept.
    ctx, pg = fresh(); change(pg)
    ctx.set_offline(True); pg.wait_for_timeout(400)
    check("Offline is shown in the status", status(pg) == "Offline: kept in this browser", status(pg))
    ctx.set_offline(False); pg.wait_for_timeout(400)
    check("Back online, it says Not saved yet again", status(pg) == "Not saved yet", status(pg))
    ctx.close()

    # 5. Reload straight after a change (before the usual pause): nothing is lost, and it says so.
    ctx, pg = fresh(); change(pg, wait=50)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    weight = frame(pg).evaluate("getComputedStyle(document.querySelector(\"[data-el='line']\")).fontWeight")
    check("A change made just before reloading is kept", weight in ("700", "bold"), weight)
    check("After reloading the change is marked Not saved yet", status(pg) == "Not saved yet", status(pg))
    check("The message explains how to go back to the published page", "Discard changes" in notice(pg) and "Undo removes them" not in notice(pg), notice(pg)[:120])
    # Discard is undoable, so it never silently throws work away.
    pg.locator(".editor-more-wrap > button").click(); pg.get_by_role("button", name="Discard changes").click(); pg.wait_for_timeout(600)
    check("Discard returns to the published page", status(pg) == "Same as the website", status(pg))
    pg.locator(".editor-notice button", has_text="Undo").click(); pg.wait_for_timeout(800)
    weight = frame(pg).evaluate("getComputedStyle(document.querySelector(\"[data-el='line']\")).fontWeight")
    check("Undo after Discard brings the changes back", weight in ("700", "bold") and status(pg) == "Not saved yet", f"{weight} {status(pg)}")
    ctx.close()

    # 6. Closing the tab: no question when work is kept; a question when it could be lost.
    ctx, pg = fresh(); change(pg)
    asks = lambda: pg.evaluate("() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented }")
    check("Closing with work kept in the browser does not ask", asks() is False)
    ctx.close()
    ctx, pg = fresh()
    pg.evaluate("() => { Storage.prototype._set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k.endsWith(':unsaved')) throw new Error('full'); return this._set(k, v) } }")
    change(pg)
    check("If the browser will not keep a copy, the status warns", status(pg) == "Not saved, and not kept here", status(pg))
    asks = lambda: pg.evaluate("() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented }")
    check("Then closing the tab asks first", asks() is True)
    ctx.close()

    # 7. Publish: success only after GitHub confirms; a refusal or lost connection claims nothing.
    for how, ok in (("422", False), ("abort", False), ("ok", True)):
        ctx, pg = fresh(); change(pg)
        mode.update(patch=how)
        pg.get_by_role("button", name="Publish").first.click(); pg.wait_for_timeout(4500)
        pg.locator(".editor-panel .editor-primary").click(); pg.wait_for_timeout(1500)
        s = status(pg)
        if ok: check("Publish shows Published only after GitHub confirms", s.startswith("Published ") and unsaved_copy(pg) is None, s)
        else: check(f"Publish refused ({how}): not claimed, work kept", s == "Not saved: see the message" and unsaved_copy(pg) is not None, s)
        ctx.close()
    mode.update(patch="ok")

    # 8. The same page open in two tabs is pointed out.
    ctx, pg = fresh(); pg2 = ctx.new_page(); pg2.goto(URL, wait_until="networkidle"); pg2.wait_for_timeout(2500)
    change(pg2); pg.wait_for_timeout(600)
    check("A change in another tab is pointed out", "another tab" in notice(pg), notice(pg)[:100])
    ctx.close()

    # 9. Loading the standard layout can be undone.
    ctx, pg = fresh(); change(pg)
    pg.locator(".editor-more-wrap > button").click(); pg.get_by_role("button", name="Standard layout").click(); pg.wait_for_timeout(400)
    load = pg.locator(".editor-panel button", has_text="standard")
    if load.count(): load.first.click(); pg.wait_for_timeout(600)
    pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(800)
    weight = frame(pg).evaluate("getComputedStyle(document.querySelector(\"[data-el='line']\")).fontWeight")
    check("Undo after loading the standard layout brings the page back", weight in ("700", "bold"), weight)
    ctx.close()

    # 10. Fix 1, repeated saves: three saves with a change between each send three saves; a failed save,
    #     a retry and a repeat of the same click send exactly what is needed and claim nothing early.
    ctx, pg = fresh(); before = puts()
    for k in range(3):
        change(pg); pg.locator(".editor-save").click(); pg.wait_for_timeout(900)
    check("Three changes saved one after another send three saves", puts() - before == 3 and status(pg).startswith("Draft saved "), str(puts() - before))
    change(pg); mode.update(put="abort"); before = puts()
    pg.locator(".editor-save").click(); pg.wait_for_timeout(900)
    mode.update(put="ok"); pg.locator(".editor-save").click(); pg.wait_for_timeout(900)
    pg.locator(".editor-save").click(); pg.wait_for_timeout(900)
    check("Failed, retried, then clicked again: two attempts sent, the third says Already saved", puts() - before == 2 and "Already saved" in notice(pg), f"{puts() - before} | {notice(pg)[:60]}")
    ctx.close()

    # 11. Fix 2, Discard and Undo: twice in a row, and again after a reload, nothing is lost.
    ctx, pg = fresh(); change(pg)
    w = lambda: frame(pg).evaluate("getComputedStyle(document.querySelector(\"[data-el='line']\")).fontWeight")
    ok = True
    for k in range(2):
        pg.locator(".editor-more-wrap > button").click(); pg.get_by_role("button", name="Discard changes").click(); pg.wait_for_timeout(600)
        ok &= w() not in ("700", "bold")
        pg.locator(".editor-notice button", has_text="Undo").click(); pg.wait_for_timeout(800)
        ok &= w() in ("700", "bold")
    check("Discard then Undo, twice in a row, brings the changes back each time", ok)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    check("After those, a reload still has the changes", w() in ("700", "bold") and status(pg) == "Not saved yet", status(pg))
    pg.locator(".editor-more-wrap > button").click(); pg.get_by_role("button", name="Discard changes").click(); pg.wait_for_timeout(600)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    check("A Discard that is not undone stays discarded after a reload", w() not in ("700", "bold") and status(pg) == "Same as the website", status(pg))
    ctx.close()

    # 12. Fix 3, sudden interruption: the tab closed (no time for the usual pause), or hidden, straight
    #     after a change. A new tab of the same browser still has the change.
    for how in ("closed", "hidden"):
        ctx, pg = fresh()
        change(pg, wait=30)
        if how == "closed": pg.close()
        else:
            pg.evaluate("() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }")
            pg.wait_for_timeout(50); kept = pg.evaluate("localStorage.getItem('design-editor:about-face-beauty:unsaved')"); pg.close()
        pg2 = ctx.new_page(); pg2.goto(URL, wait_until="networkidle"); pg2.wait_for_timeout(2500)
        weight = [fr for fr in pg2.frames if fr != pg2.main_frame][0].evaluate("getComputedStyle(document.querySelector(\"[data-el='line']\")).fontWeight")
        check(f"Tab {how} 30 ms after a change: the change is still there in a new tab", weight in ("700", "bold"), weight)
        ctx.close()

    # 13. Loading an earlier version can be undone: Undo names the step and brings the page back.
    VERSION["on"] = True
    ctx, pg = fresh(); change(pg)
    pg.locator(".editor-more-wrap > button").click(); pg.get_by_role("button", name="Versions").click(); pg.wait_for_timeout(1500)
    pg.locator(".editor-panel button", has_text="Load into editor").first.click(); pg.wait_for_timeout(900)
    w = lambda: frame(pg).evaluate("getComputedStyle(document.querySelector(\"[data-el='line']\")).fontWeight")
    loaded = w()
    check("Loading an earlier version replaces the page in the editor", loaded not in ("700", "bold"), loaded)
    check("The message says nothing is published and Undo goes back", "Undo takes you back" in notice(pg), notice(pg)[:120])
    pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(800)
    check("Undo after loading a version brings the page back exactly", w() in ("700", "bold"), w())
    pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(800)
    check("Redo loads the version again", w() not in ("700", "bold"), w())
    ctx.close(); VERSION["on"] = False

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
