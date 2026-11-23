from playwright.sync_api import sync_playwright
def frame(pg): return [f for f in pg.frames if f!=pg.main_frame][0]
res=[]
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ")+n+(f"  [{d}]" if d else ""))
def looks(pg):
    d=pg.evaluate("JSON.parse(localStorage.getItem('design-editor:about-face-beauty:unsaved')||'null')") or {}
    out={}
    for it in d.get("content",[]): out[it["type"]]=it["props"].get("elements") or {}
    return out
def lk(pg,block,key,scr): return looks(pg).get(block,{}).get(key,{}).get(scr,{})
TARGETS=[("Outcomes","#outcomes [data-el='skills-label']","skills-label"),("Outcomes","#outcomes [data-el='skills']","skills"),("Overview","#overview [data-el='label-did']","label-did")]
def click(pg,f,sel,shift=False):
    l=f.locator(sel).first; l.scroll_into_view_if_needed(); pg.wait_for_timeout(200); b=l.bounding_box()
    if shift: pg.keyboard.down("Shift")
    pg.mouse.click(b["x"]+6,b["y"]+b["height"]/2)
    if shift: pg.keyboard.up("Shift")
    pg.wait_for_timeout(500)
with sync_playwright() as p:
    br=p.chromium.launch()
    for w,h,scr,key in ((1440,900,"Desktop","desktop"),(1024,768,"Tablet","tablet"),(390,844,"Phone","phone")):
        pg=br.new_page(viewport={"width":w,"height":h}); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
        pg.goto("http://localhost:4302/admin/design/?project=about-face-beauty",wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
        f=frame(pg)
        touch = scr!="Desktop"
        click(pg,f,TARGETS[0][1])
        if touch:
            # touchscreen route: "Select more", then taps
            pg.locator(".ctx button[aria-label='Select more']").click(); pg.wait_for_timeout(300)
            for _,sel,_ in TARGETS[1:]: click(pg,f,sel)
        else:
            for _,sel,_ in TARGETS[1:]: click(pg,f,sel,shift=True)
        name=pg.locator(".ctx .ctx-name").first.inner_text()
        check(f"{scr}: bar says 3 selected", name.strip()=="3 selected", name)
        n=f.evaluate("document.querySelectorAll('[data-el-group]').length"); g=f.evaluate("[...document.querySelectorAll('.el-gframe')].filter(e=>e.style.display!=='none').length")
        check(f"{scr}: every part outlined", n==3 and g==2, f"marked {n}, extra frames {g}")
        # shared formatting, one undo step
        pg.locator(".ctx button[aria-label='Bold, all selected']").click(); pg.wait_for_timeout(600)
        ok=all(lk(pg,b,k,key).get("weight")==700 for b,_,k in TARGETS)
        check(f"{scr}: Bold applies to all three, saved for {scr}", ok, str([lk(pg,b,k,key) for b,_,k in TARGETS]))
        pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(600)
        check(f"{scr}: one undo removes all three", all(not lk(pg,b,k,key).get("weight") for b,_,k in TARGETS))
        # still grouped after undo?
        # move with arrow keys (desktop) — keyboard only on desktop
        if not touch:
            fb=f.locator(".el-frame").bounding_box(); pg.mouse.click(fb["x"]+fb["width"]/2,fb["y"]+fb["height"]/2); pg.wait_for_timeout(300)
            pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(600)
            xs=[lk(pg,b,k,key).get("x") for b,_,k in TARGETS]
            check(f"{scr}: arrow key moves all three by the same amount", len(set(xs))==1 and xs[0] not in (None,0), str(xs))
            pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(600)
            check(f"{scr}: one undo puts all three back", all(lk(pg,b,k,key).get("x") is None for b,_,k in TARGETS))
        # drag the group by its frame
        fr=f.locator(".el-frame").bounding_box()
        x0=fr["x"]+fr["width"]/2; y0=fr["y"]+fr["height"]/2
        before=f.evaluate("[...document.querySelectorAll('[data-el-group]')].map(e=>e.getBoundingClientRect().left)")
        pg.mouse.move(x0,y0); pg.mouse.down(); pg.mouse.move(x0+20,y0,steps=4); pg.mouse.move(x0+40,y0,steps=4); pg.mouse.up(); pg.wait_for_timeout(700)
        xs=[lk(pg,b,k,key).get("x") for b,_,k in TARGETS]
        after=f.evaluate("[...document.querySelectorAll('[data-el-group]')].map(e=>e.getBoundingClientRect().left)")
        shifts=[round(a-b_) for a,b_ in zip(after,before)]
        check(f"{scr}: dragging moves all three together", all(x is not None for x in xs) and len(set(shifts))==1 and shifts[0]!=0, f"x {xs} shifts {shifts}")
        pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(600)
        check(f"{scr}: one undo undoes the drag", all(lk(pg,b,k,key).get("x") is None for b,_,k in TARGETS))
        # remove one from the group
        if touch: click(pg,f,TARGETS[2][1])
        else: click(pg,f,TARGETS[2][1],shift=True)
        name=pg.locator(".ctx .ctx-name").first.inner_text()
        check(f"{scr}: tapping or Shift-clicking a member removes it", name.strip()=="2 selected", name)
        # Done clears
        pg.locator(".ctx button[aria-label='Done, deselect all (Esc)']").click(); pg.wait_for_timeout(400)
        check(f"{scr}: Done clears the group", f.evaluate("document.querySelectorAll('[data-el-group], .el-gframe').length")==0)
        check(f"{scr}: no overflow, no script errors", pg.evaluate("document.documentElement.scrollWidth<=innerWidth") and not errs, str(errs[:2]))
        if scr=="Desktop": 
            click(pg,f,TARGETS[0][1]); click(pg,f,TARGETS[1][1],shift=True); pg.screenshot(path=__import__("tempfile").gettempdir()+"/multi_desktop.png")
        pg.close()
    print(f"{sum(res)} of {len(res)} passed"); br.close()
