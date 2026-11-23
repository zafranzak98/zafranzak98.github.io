import sys, json
from playwright.sync_api import sync_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else "http://localhost:4302/admin/design/"
def frame(pg): return [f for f in pg.frames if f!=pg.main_frame][0]
res=[]
def check(n, ok, d=""): res.append(ok); print(("PASS " if ok else "FAIL ")+n+(f"  [{d}]" if d else ""), flush=True)
def unsaved(pg): return pg.evaluate("JSON.parse(localStorage.getItem('design-editor:about-face-beauty:unsaved')||'null')") or {}
def cover(pg): 
    for it in unsaved(pg).get("content",[]):
        if it["type"]=="Opening": return (it["props"].get("elements") or {}).get("image",{})
    return {}
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    for w,h,screen in ((1440,900,"Desktop"),(1024,768,"Tablet"),(390,844,"Phone")):
        pg=b.new_page(viewport={"width":w,"height":h}); pg.on("pageerror",lambda e: errs.append(str(e)))
        pg.goto(BASE+"?project=about-face-beauty",wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
        f=frame(pg)
        im=f.locator("[data-el='image']").first; im.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        before=im.bounding_box(); text_before=f.locator(".cs-open-text").first.bounding_box()
        pg.mouse.click(before["x"]+before["width"]/2, before["y"]+before["height"]/2); pg.wait_for_timeout(600)
        pg.locator(".ctx button",has_text="Large").first.click(); pg.wait_for_timeout(900)
        after=f.locator("[data-el='image']").first.bounding_box(); text_after=f.locator(".cs-open-text").first.bounding_box()
        key={"Desktop":"desktop","Tablet":"tablet","Phone":"phone"}[screen]
        c=cover(pg)
        check(f"{screen}: Large cover is bigger and keeps its shape", after["width"]>before["width"]+5 and abs(after["height"]/after["width"]-before["height"]/before["width"])<0.03, f"{before['width']:.0f}->{after['width']:.0f}")
        check(f"{screen}: saved for {screen} only", c.get(key,{}).get("cover")=="large" and all(k==key for k in c), json.dumps(c))
        if screen!="Phone":
            check(f"{screen}: text beside it makes room (no overlap)", text_after["x"]+text_after["width"]<=after["x"]+2, f"text right {text_after['x']+text_after['width']:.0f}, cover left {after['x']:.0f}")
        doc_w=pg.evaluate("document.documentElement.scrollWidth<=innerWidth"); check(f"{screen}: nothing runs off the editor", doc_w)
        pg.close()
    # drag handle steps (desktop)
    pg=b.new_page(viewport={"width":1440,"height":900}); pg.goto(BASE+"?project=about-face-beauty",wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    f=frame(pg); im=f.locator("[data-el='image']").first; bb=im.bounding_box(); pg.mouse.click(bb["x"]+bb["width"]/2,bb["y"]+bb["height"]/2); pg.wait_for_timeout(600)
    h=f.locator(".el-frame .el-handle").bounding_box(); x,y=h["x"]+h["width"]/2,h["y"]+h["height"]/2
    pg.mouse.move(x,y); pg.mouse.down()
    for i in range(1,21): pg.mouse.move(x-160*i/20,y); pg.wait_for_timeout(20)
    pg.mouse.up(); pg.wait_for_timeout(800)
    check("Dragging the cover's handle moves through the sizes", cover(pg).get("desktop",{}).get("cover") in ("large","xl"), json.dumps(cover(pg)))
    pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(600)
    check("Undo returns the cover to its size", not cover(pg).get("desktop"))
    # category rename
    c=f.locator("[data-el='cat-brand-communications']").first; c.scroll_into_view_if_needed(); cb=c.bounding_box()
    pg.mouse.click(cb["x"]+5,cb["y"]+cb["height"]/2); pg.wait_for_timeout(500)
    check("Category name selects on its own with a shared-name note", "Shared" in pg.locator(".ctx").inner_text())
    pg.mouse.dblclick(cb["x"]+5,cb["y"]+cb["height"]/2); pg.wait_for_timeout(500); pg.keyboard.press("ControlOrMeta+a"); pg.keyboard.type("Brand Campaigns"); pg.keyboard.press("Enter"); pg.wait_for_timeout(800)
    shown=f.locator("[data-el='cat-brand-communications']").first.inner_text()
    edits=unsaved(pg).get("root",{}).get("props",{}).get("edits",{})
    check("Renamed on the page and kept as a shared edit", shown.strip().upper()=="BRAND CAMPAIGNS" and edits.get("category:brand-communications")=="Brand Campaigns", f"{shown} {edits}")
    bb2=c.bounding_box(); pg.mouse.move(bb2["x"]+5,bb2["y"]+5); pg.mouse.down(); pg.mouse.move(bb2["x"]+60,bb2["y"]+20,steps=10); pg.mouse.up(); pg.wait_for_timeout(500)
    els=[it["props"].get("elements") for it in unsaved(pg).get("content",[]) if it["type"]=="CategoryNav"]
    check("Shared names cannot be dragged out of place", not any(els), str(els))
    pg.get_by_role("button",name="Publish").first.click(); pg.wait_for_timeout(4500)
    t=pg.locator(".editor-panel").inner_text()
    check("Publish warns that other pages change too", "also changes other pages" in t and "Brand Communications → Brand Campaigns" in t, t[:160])
    check("No script errors", not errs, "; ".join(errs[:2]))
    print(f"{sum(res)} of {len(res)} passed"); b.close()
