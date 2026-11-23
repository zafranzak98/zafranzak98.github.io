# Arrange (align and space evenly) for a group, at Desktop, Tablet and Phone. Run from the repository
# root after `bun run build:preview` and `python3 tests/editor/serve.py dist 4302 &`.
from playwright.sync_api import sync_playwright
ED="http://localhost:4302/admin/design/?project=about-face-beauty"
res=[]
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ")+n+(f"  [{d}]" if d else ""))
def frame(pg): return [f for f in pg.frames if f!=pg.main_frame][0]
TARGETS=["#outcomes [data-el='skills-label']","#outcomes [data-el='figure-label-0']","#overview [data-el='label-did']"]
def click(pg,f,sel):
    l=f.locator(sel).first; l.scroll_into_view_if_needed(); pg.wait_for_timeout(200); b=l.bounding_box(); pg.mouse.click(b["x"]+6,b["y"]+b["height"]/2); pg.wait_for_timeout(400)
def rects(f): return f.evaluate("s=>s.map(q=>{const r=document.querySelector(q).getBoundingClientRect();return [r.left,r.right,r.top,r.bottom]})", TARGETS)
def arrange(pg,label):
    pg.locator(".ctx .ctx-arrange > button").click(); pg.wait_for_timeout(200)
    pg.locator(".ctx-menu button",has_text=label).click(); pg.wait_for_timeout(700)
near=lambda xs: max(xs)-min(xs)<=1.5
with sync_playwright() as p:
    br=p.chromium.launch()
    for w,h,scr in ((1440,900,"Desktop"),(1024,768,"Tablet"),(390,844,"Phone")):
        pg=br.new_page(viewport={"width":w,"height":h}); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
        pg.goto(ED,wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
        f=frame(pg)
        click(pg,f,TARGETS[0]); pg.locator(".ctx button[aria-label='Select more']").click()
        for s in TARGETS[1:]: click(pg,f,s)
        pg.locator(".ctx button[aria-label='Select more']").click()
        check(f"{scr}: three selected", pg.locator(".ctx .ctx-name").first.inner_text().strip()=="3 selected")
        before=rects(f)
        for label,idx,fn in (("Align left edges",0,None),("Align right edges",1,None),("Align centres",None,lambda r:(r[0]+r[1])/2)):
            arrange(pg,label); r=rects(f)
            vals=[fn(x) for x in r] if fn else [x[idx] for x in r]
            check(f"{scr}: {label}", near(vals), str([round(v) for v in vals]))
            pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(600)
            check(f"{scr}: one undo restores after {label}", rects(f)==before)
        arrange(pg,"Space evenly down"); r=sorted(rects(f),key=lambda x:x[2])
        gaps=[r[i+1][2]-r[i][3] for i in range(len(r)-1)]
        check(f"{scr}: Space evenly down gives equal gaps", abs(gaps[0]-gaps[1])<=1.5, str([round(g) for g in gaps]))
        check(f"{scr}: first and last stay put", abs(r[0][2]-sorted(before,key=lambda x:x[2])[0][2])<1 and abs(r[-1][3]-sorted(before,key=lambda x:x[2])[-1][3])<1)
        pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(600)
        check(f"{scr}: no overflow, no script errors", pg.evaluate("document.documentElement.scrollWidth<=innerWidth") and not errs, str(errs[:1]))
        pg.close()
    print(f"{sum(res)} of {len(res)} passed"); br.close()
