import json
from playwright.sync_api import sync_playwright
res=[]
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ")+n+(f"  [{d}]" if d else ""))
URL="http://zafranzak98.github.io:4302/admin/design/?project=about-face-beauty"
TOK="ghu_"+"A"*36; NEW="ghu_"+"B"*36
ENTRY=json.dumps({"backendName":"github","id":1,"login":"zafranzak98","token":TOK,"refreshToken":"ghr_"+"R"*60})
seen=[]
def api(route):
    auth=route.request.headers.get("authorization","")
    seen.append((route.request.url.split("api.github.com")[1], auth[-6:]))
    if "/user" == route.request.url.split("api.github.com")[1]:
        if auth.endswith("A"*6) and state["expired"]: return route.fulfill(status=401, json={"message":"Bad credentials"})
        return route.fulfill(status=200, json={"login":"zafranzak98"})
    return route.fulfill(status=401, json={"message":"Bad credentials"})
state={"expired":False}
with sync_playwright() as p:
    b=p.chromium.launch(args=["--host-resolver-rules=MAP zafranzak98.github.io 127.0.0.1"])
    def fresh(entry=None, own=None):
        ctx=b.new_context(viewport={"width":1440,"height":900}); ctx.route("https://api.github.com/**", api)
        pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
        pg.goto(URL); pg.evaluate("([e,o])=>{localStorage.clear(); if(e) localStorage.setItem('sveltia-cms.user',e); if(o) sessionStorage.setItem('design-editor:token',o)}",[entry,own])
        pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2000)
        return ctx,pg,errs
    signin=lambda pg: pg.locator(".editor-signin").is_visible()
    def more_text(pg):
        pg.locator(".editor-more-wrap > button").click(); t=pg.locator(".editor-more").inner_text(); pg.locator(".editor-more-wrap > button").click(); return t
    # 1 shared sign-in used
    ctx,pg,errs=fresh(ENTRY)
    check("Shared sign-in: no Sign in button", not signin(pg))
    t=more_text(pg); check("More shows who and that it is shared", "signed in as zafranzak98, shared with the website editor" in t, t.split("Sign out")[-1][:90])
    check("Checked with GitHub on open, using the shared token", ("/user",TOK[-6:]) in seen)
    check("No script errors", not errs, str(errs[:1]))
    # 5 renewal in another tab
    pg2=ctx.new_page(); pg2.goto(URL); pg2.evaluate("e=>localStorage.setItem('sveltia-cms.user',e)", ENTRY.replace(TOK,NEW)); pg.wait_for_timeout(800)
    check("Renewal in another tab is picked up", ("/user",NEW[-6:]) in seen and not signin(pg))
    # 8 save with refused token -> message, entry kept
    before=pg.evaluate("localStorage.getItem('sveltia-cms.user')")
    pg.locator(".editor-save").click(); pg.wait_for_timeout(1200)
    note=pg.locator(".editor-notice, [role=status], .editor-demo").all_inner_texts()
    txt=" ".join(note)
    check("Expired during a save: clear message mentioning /admin", "expired" in txt and "/admin" in txt, txt[:160])
    check("Expired: Sign in offered", signin(pg))
    check("Expired: website editor's entry (and its renewal key) left untouched", pg.evaluate("localStorage.getItem('sveltia-cms.user')")==before)
    ctx.close()
    # 4 expired on open
    state["expired"]=True
    ctx,pg,errs=fresh(ENTRY)
    check("Expired on open: Sign in offered", signin(pg))
    check("Expired on open: entry untouched", pg.evaluate("localStorage.getItem('sveltia-cms.user')")==ENTRY)
    ctx.close(); state["expired"]=False
    # 2/3 missing or odd entries
    for label,e in [("missing",None),("not JSON","{oops"),("no token",json.dumps({"backendName":"github"})),("other backend",json.dumps({"backendName":"gitlab","token":TOK})),("odd token",json.dumps({"backendName":"github","token":"<script>"}))]:
        ctx,pg,errs=fresh(e)
        check(f"Entry {label}: falls back to Sign in, no errors", signin(pg) and not errs, str(errs[:1]))
        ctx.close()
    # own sign-in fallback still works
    ctx,pg,errs=fresh(None, NEW)
    check("Own tab-only sign-in still used when there is no shared one", not signin(pg))
    ctx.close()
    # 6 sign out
    ctx,pg,errs=fresh(ENTRY, NEW)
    pg.locator(".editor-more-wrap > button").click(); pg.locator(".editor-more button", has_text="Sign out").click(); pg.wait_for_timeout(600)
    gone=pg.evaluate("[localStorage.getItem('sveltia-cms.user'), sessionStorage.getItem('design-editor:token')]")
    check("Sign out removes both sign-ins in this browser", gone==[None,None], str(gone))
    txt=" ".join(pg.locator("body").all_inner_texts())
    check("Sign out explains how to revoke at GitHub", "revoke" in txt and "Zafran website editor (Sveltia CMS)" in txt)
    check("Sign in offered after signing out", signin(pg))
    # 7 sign-out in another tab
    ctx.close()
    ctx,pg,errs=fresh(ENTRY)
    pg2=ctx.new_page(); pg2.goto(URL); pg2.evaluate("localStorage.removeItem('sveltia-cms.user')"); pg.wait_for_timeout(800)
    check("Signing out elsewhere (e.g. /admin) signs this tab out", signin(pg))
    ctx.close()
    # demo host unchanged
    ctx=b.new_context(); pg=ctx.new_page(); pg.goto("http://localhost:4302/admin/design/?project=about-face-beauty",wait_until="networkidle"); pg.wait_for_timeout(1500)
    check("Demo (localhost) still never shows sign-in", not signin(pg))
    ctx.close()
    print(f"{sum(res)} of {len(res)} passed"); b.close()
