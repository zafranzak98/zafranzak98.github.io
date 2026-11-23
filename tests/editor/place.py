from playwright.sync_api import sync_playwright
def frame(pg): return [f for f in pg.frames if f!=pg.main_frame][0]
res=[]
def check(n, ok, d=""): res.append(ok); print(("PASS " if ok else "FAIL ")+n+(f"  [{d}]" if d else ""))
def look(pg,block,key):
    d=pg.evaluate("JSON.parse(localStorage.getItem('design-editor:about-face-beauty:unsaved')||'null')") or {}
    for it in d.get("content",[]):
        if it["type"]==block: return (it["props"].get("elements") or {}).get(key,{})
    return {}
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h,scr in ((1440,900,"Desktop"),(1024,768,"Tablet"),(390,844,"Phone")):
        pg=b.new_page(viewport={"width":w,"height":h})
        pg.goto("http://localhost:4302/admin/design/?project=about-face-beauty",wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
        f=frame(pg); l=f.locator("#outcomes [data-el='skills-label']").first; l.scroll_into_view_if_needed(); b0=l.bounding_box(); pg.mouse.click(b0["x"]+6,b0["y"]+b0["height"]/2); pg.wait_for_timeout(600)
        if scr=="Desktop": pg.screenshot(path=__import__("tempfile").gettempdir()+"/place_bar.png",clip={"x":0,"y":60,"width":1440,"height":70})
        btn=pg.locator(".ctx button[aria-label='Box: centre of its area']")
        if btn.is_visible(): btn.click()
        else:
            pg.locator(".ctx button",has_text="ettings").first.click(); pg.wait_for_timeout(600)
            pg.locator("[aria-label='Box position']:visible button",has_text="Centre").first.click()
        pg.wait_for_timeout(800)
        g=f.evaluate("(()=>{const e=document.querySelector(\"#outcomes [data-el='skills-label']\");const r=e.getBoundingClientRect(),q=e.parentElement.getBoundingClientRect();return [r.left+r.width/2, q.left+q.width/2, r.width, q.width]})()")
        key={"Desktop":"desktop","Tablet":"tablet","Phone":"phone"}[scr]
        lk=look(pg,"Outcomes","skills-label")
        check(f"{scr}: box centred in its area", abs(g[0]-g[1])<2 and g[2]<g[3], str([round(x) for x in g]))
        check(f"{scr}: saved for {scr} only", lk.get(key,{}).get("place")=="center" and list(lk)==[key], str(lk))
        check(f"{scr}: no overflow", pg.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(600)
        check(f"{scr}: undo removes it", not look(pg,"Outcomes","skills-label"))
        pg.close()
    print(f"{sum(res)} of {len(res)} passed"); b.close()
