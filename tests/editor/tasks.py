import sys
from playwright.sync_api import sync_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else "http://localhost:4302"
def frame(pg): return [f for f in pg.frames if f!=pg.main_frame][0]
res=[]
def check(n, ok, steps, note=""):
    res.append(ok); print(("PASS " if ok else "FAIL ")+f"{n} ({steps} steps){'  ['+note+']' if note else ''}", flush=True)
def centre(l):
    b=l.bounding_box(); return b["x"]+b["width"]/2, b["y"]+b["height"]/2
def words(l):
    b=l.bounding_box(); return b["x"]+6, b["y"]+b["height"]/2
def unsaved(pg): return pg.evaluate("JSON.parse(localStorage.getItem('design-editor:about-face-beauty:unsaved')||'null')")
def look(pg, block, key): 
    d=unsaved(pg) or {}
    for it in d.get("content",[]):
        if it["type"]==block: return (it["props"].get("elements") or {}).get(key)
def edits(pg): return ((unsaved(pg) or {}).get("root",{}).get("props",{}) or {}).get("edits",{})
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900}); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(f"{BASE}/admin/design/?project=about-face-beauty",wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    f=frame(pg)
    def el(sel): l=f.locator(sel).first; l.scroll_into_view_if_needed(); pg.wait_for_timeout(300); return l
    # 1 spelling
    l=el("#overview [data-el='label-did']"); x,y=words(l); pg.mouse.dblclick(x,y); pg.wait_for_timeout(500)
    pg.keyboard.press("End"); pg.keyboard.type(" here"); pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
    check("1 Correct a spelling mistake (double-click, type, Enter)", edits(pg).get("labels:what_i_did","").endswith(" here"), 3, str(edits(pg)))
    # 2 heading
    l=el("[data-el='title']"); x,y=words(l); pg.mouse.dblclick(x,y); pg.wait_for_timeout(500); pg.keyboard.press("ControlOrMeta+a"); pg.keyboard.type("AF-BINARY TEST"); pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
    check("2 Change a heading", edits(pg).get("title")=="AF-BINARY TEST", 3)
    # 3 colour
    l=el("#outcomes [data-el='skills-label']"); x,y=words(l); pg.mouse.click(x,y); pg.wait_for_timeout(600)
    pg.locator(".ctx button[aria-label='Olive']").click(); pg.wait_for_timeout(700)
    check("3 Change text colour (select, swatch)", (look(pg,"Outcomes","skills-label") or {}).get("desktop",{}).get("colour")=="Olive", 3)
    # 4 typography
    pg.locator(".ctx button[aria-label='Larger text']").click(); pg.wait_for_timeout(300); pg.locator(".ctx button[aria-label='Bold']").click(); pg.wait_for_timeout(700)
    d=(look(pg,"Outcomes","skills-label") or {}).get("desktop",{})
    check("4 Adjust typography (A+, Bold)", d.get("size") and d.get("weight")==700, 2, str(d))
    # 5 move image
    l=el("[data-el='image']"); x,y=centre(l); pg.mouse.click(x,y); pg.wait_for_timeout(600)
    pg.mouse.move(x,y); pg.mouse.down()
    for i in range(1,21): pg.mouse.move(x-60*i/20,y+20*i/20); pg.wait_for_timeout(20)
    pg.mouse.up(); pg.wait_for_timeout(800)
    d=(look(pg,"Opening","image") or {}).get("desktop",{})
    check("5 Move an image (drag it)", d.get("x",0)<0 and d.get("y",0)>0, 2, str(d))
    # 6 resize + crop (an image in The work)
    l=el("#work [data-el='image-0']"); x,y=centre(l); pg.mouse.click(x,y); pg.wait_for_timeout(600)
    h=f.locator(".el-frame .el-handle"); hx,hy=centre(h); pg.mouse.move(hx,hy); pg.mouse.down()
    for i in range(1,21): pg.mouse.move(hx-80*i/20,hy); pg.wait_for_timeout(20)
    pg.mouse.up(); pg.wait_for_timeout(800)
    pg.locator(".ctx button", has_text="settings").first.click(); pg.wait_for_timeout(600)
    pg.get_by_role("button",name="Focus top centre").first.click(); pg.wait_for_timeout(600)
    pg.locator(".ctx button", has_text="settings").first.click(); pg.wait_for_timeout(400)
    d=(look(pg,"Work","image-0") or {}).get("desktop",{})
    check("6 Resize and crop an image (handle; crop in More settings)", d.get("width",100)<100 and d.get("focusY")==0, 2, str(d))
    # 7 phone layout
    pg.locator(".editor-screens button",has_text="Phone").click(); pg.wait_for_timeout(1500)
    f=frame(pg); l=el("#outcomes [data-el='figure-0']"); x,y=words(l); pg.mouse.click(x,y); pg.wait_for_timeout(600); pg.keyboard.press("ArrowRight"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(700)
    d=look(pg,"Outcomes","figure-0") or {}
    check("7 Adjust phone layout only", d.get("phone",{}).get("x",0)>0 and "desktop" not in d, 3, str(d))
    pg.locator(".editor-screens button",has_text="Desktop").click(); pg.wait_for_timeout(1500); f=frame(pg)
    # 8 duplicate a section
    before=len((unsaved(pg) or {}).get("content",[]))
    o=el("#overview"); x,y=centre(o); pg.mouse.click(o.bounding_box()["x"]+o.bounding_box()["width"]-20, o.bounding_box()["y"]+10); pg.wait_for_timeout(700)
    dup=pg.locator(".ctx button", has_text="Duplicate")
    ok = dup.count()>0
    if ok: dup.first.click(); pg.wait_for_timeout(800)
    after=len((unsaved(pg) or {}).get("content",[]))
    check("8 Duplicate (a section)", ok and after==before+1, 2, f"{before}->{after}; button found {dup.count()}")
    # 10 undo
    pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(800)
    check("10 Undo a mistake (Cmd+Z)", len((unsaved(pg) or {}).get("content",[]))==before, 1)
    # 9 reorder via page navigator
    pg.get_by_text("Page navigator").first.click(); pg.wait_for_timeout(800)
    nav=pg.locator("[class*='Outline'], [class*='LayerTree']").first
    check("9 Page navigator opens with sections listed", nav.count()>0 and "Outcomes" in nav.inner_text(), 1)
    # 11 preview
    pg.get_by_role("button",name="Preview").click(); pg.wait_for_timeout(800)
    marks=f.evaluate("()=>[...document.querySelectorAll('.el-frame,.el-hover')].filter(e=>getComputedStyle(e).display!=='none').length")
    check("11 Preview the page", marks==0 and pg.get_by_role("button",name="Back to editing").count()==1, 1)
    pg.get_by_role("button",name="Back to editing").click(); pg.wait_for_timeout(600)
    # 12 restore version
    pg.get_by_role("button",name="Publish").click(); pg.wait_for_timeout(4500); pg.locator(".editor-panel button.editor-primary").click(); pg.wait_for_timeout(800)
    l=el("[data-el='title']"); x,y=words(l); pg.mouse.dblclick(x,y); pg.wait_for_timeout(400); pg.keyboard.press("ControlOrMeta+a"); pg.keyboard.type("CHANGED AGAIN"); pg.keyboard.press("Enter"); pg.wait_for_timeout(800)
    pg.locator(".editor-more-wrap > button").click(); pg.get_by_role("button",name="Versions").click(); pg.wait_for_timeout(800)
    pg.locator(".editor-versions button").first.click(); pg.wait_for_timeout(1000)
    t=frame(pg).locator("[data-el='title']").first.inner_text()
    check("12 Restore an earlier version (More, Versions, Load)", t.strip().upper()=="AF-BINARY TEST", 3, t)
    print("script errors:", errs)
    print(f"{sum(res)} of {len(res)} passed"); b.close()
