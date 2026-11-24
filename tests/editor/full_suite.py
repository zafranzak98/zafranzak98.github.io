import sys, json
from playwright.sync_api import sync_playwright
ED=(sys.argv[1] if len(sys.argv)>1 else "http://localhost:4302/admin/design/")+"?project=about-face-beauty"
KEY="design-editor:about-face-beauty:"
import os
AXE=open(os.environ.get('AXE', '/tmp/axe/node_modules/axe-core/axe.min.js')).read()
res=[]
def check(n, ok, d=""): res.append((n,bool(ok))); print(("PASS " if ok else "FAIL ")+n+(f"  [{d}]" if d else ""), flush=True)
def frame(pg): return [f for f in pg.frames if f!=pg.main_frame][0]
def unsaved(pg): return pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}unsaved')||'null')") or {}
def look(pg, block, key):
    for it in unsaved(pg).get("content",[]):
        if it["type"]==block: return (it["props"].get("elements") or {}).get(key) or {}
    return {}
def centre(b): return b["x"]+b["width"]/2, b["y"]+b["height"]/2
def fresh(pg):
    pg.goto(ED,wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
def pick(pg, sel, at="left"):
    l=frame(pg).locator(sel).first; l.scroll_into_view_if_needed(); pg.wait_for_timeout(300); b=l.bounding_box()
    x,y=(b["x"]+6,b["y"]+b["height"]/2) if at=="left" else centre(b); pg.mouse.click(x,y); pg.wait_for_timeout(600); return l
def drag(pg, x, y, dx, dy, alt=False):
    pg.mouse.move(x,y)
    if alt: pg.keyboard.down("Alt")
    pg.mouse.down()
    for i in range(1,26): pg.mouse.move(x+dx*i/25,y+dy*i/25); pg.wait_for_timeout(15)
    pg.wait_for_timeout(150); pg.mouse.up()
    if alt: pg.keyboard.up("Alt")
    pg.wait_for_timeout(700)
def axe(pg, ctx="document"):
    pg.add_script_tag(content=AXE)
    return pg.evaluate(f"axe.run({ctx},{{runOnly:['wcag2a','wcag2aa','wcag21aa']}}).then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>[v.id,v.nodes.length,v.nodes.slice(0,2).map(n=>n.target.join(' '))]))")

def more(pg, item):
    pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(300)
    pg.locator(".ctx-more-menu button", has_text=item).first.click(); pg.wait_for_timeout(500)
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    ctx=b.new_context(viewport={"width":1440,"height":900},bypass_csp=True); pg=ctx.new_page(); pg.on("pageerror",lambda e: errs.append(str(e)))
    fresh(pg); f=frame(pg)
    # ---- 1 Workflow and safety
    check("Opens with nothing unsaved", pg.locator(".editor-status").inner_text()=="Same as the website")
    pick(pg,"#outcomes [data-el='skills-label']"); pg.locator(".ctx button[aria-label='Larger text']").click(); pg.wait_for_timeout(900)
    check("A change shows 'Not saved yet'", "Not saved yet" in pg.locator(".editor-status").inner_text())
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    check("Unsaved work survives a refresh, with a notice", look(pg,"Outcomes","skills-label").get("desktop",{}).get("size") and "back" in pg.locator(".editor-notice").inner_text())
    pg.locator(".editor-notice button",has_text="Close").click()
    pg.locator(".editor-save").click(); pg.wait_for_timeout(800)
    check("Save draft confirms with the time", "Draft saved" in pg.locator(".editor-status").inner_text())
    pg.locator(".editor-more-wrap > button").click(); pg.locator(".editor-more button",has_text="Discard").click(); pg.wait_for_timeout(900)
    check("Discard returns to the published page", not look(pg,"Outcomes","skills-label") and pg.locator(".editor-status").inner_text()=="Same as the website")
    pg.get_by_role("button",name="Publish").first.click(); pg.wait_for_timeout(4500)
    t=pg.locator(".editor-panel").inner_text()
    check("Publish checks all three sizes; an untouched page has nothing to report", "nothing overlaps" in t)
    check("Publish dialog has keyboard focus", pg.evaluate("!!document.activeElement.closest('.editor-panel')"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Escape closes the dialog and returns focus to Publish", pg.locator(".editor-panel").count()==0 and pg.evaluate("document.activeElement.textContent.trim()")=="Publish")
    # safety checks find real problems
    lab=pick(pg,"#outcomes [data-el='figure-label-0']")
    for _ in range(4): pg.keyboard.press("Shift+ArrowUp")
    pg.locator(".ctx button[aria-label='Light sage']").click(); pg.wait_for_timeout(600)
    pg.get_by_role("button",name="Publish").first.click(); pg.wait_for_timeout(4500)
    t=pg.locator(".editor-panel").inner_text()
    check("Overlap is reported before publishing", "overlaps" in t, t[:120].replace("\n"," "))
    check("Hard-to-read colour is reported", "hard to read" in t)
    check("Publishing is still possible ('Publish anyway')", pg.locator(".editor-panel button.editor-primary").inner_text()=="Publish anyway")
    pg.locator(".editor-panel button.editor-primary").click(); pg.wait_for_timeout(900)
    check("Publish keeps a version", pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}versions')||'[]').length")==1 and "Published" in pg.locator(".editor-status").inner_text())
    # remove section with undo
    n=len(unsaved(pg).get("content",[]) or [])
    o=frame(pg).locator("#overview").first; o.scroll_into_view_if_needed(); ob=o.bounding_box(); pg.mouse.click(ob["x"]+ob["width"]-20,ob["y"]+12); pg.wait_for_timeout(600)
    more(pg,"Remove section"); pg.wait_for_timeout(300)
    note=pg.locator(".editor-notice").inner_text() if pg.locator(".editor-notice").count() else ""
    pg.locator(".editor-notice button",has_text="Undo").click(); pg.wait_for_timeout(800)
    check("Removing a section offers Undo, which brings it back", "removed" in note and frame(pg).locator("#overview").count()==1)
    # ---- 2 Moving: guides, snapping, neighbours, screen sizes
    fresh(pg); f=frame(pg)
    lab=pick(pg,"#outcomes [data-el='figure-label-0']"); fig=f.locator("#outcomes [data-el='figure-0']").first
    fig_before=fig.bounding_box(); skills_before=f.locator("#outcomes [data-el='skills-label']").first.bounding_box()
    fr=lambda: frame(pg).locator('.el-frame').bounding_box()
    lb=fr(); x,y=lb["x"]+lb["width"]/2,lb["y"]+lb["height"]/2
    drag(pg,x,y,40,0)
    msg=pg.locator(".ctx").inner_text(); lft=look(pg,"Outcomes","figure-label-0").get("desktop",{})
    check("Dragging the element itself moves it and reports where", lft.get("x",0)>0, f"{lft} | {msg[:60]}")
    check("Neighbours do not move", fig.bounding_box()==fig_before and f.locator("#outcomes [data-el='skills-label']").first.bounding_box()==skills_before)
    lb=fr(); drag(pg,lb["x"]+lb["width"]/2,lb["y"]+lb["height"]/2,-37,0)
    check("Near a guide it snaps into line", "lined up" in pg.locator(".ctx").inner_text() or abs(look(pg,"Outcomes","figure-label-0").get("desktop",{}).get("x",9))<0.05, str(look(pg,"Outcomes","figure-label-0")))
    lb=fr(); drag(pg,lb["x"]+lb["width"]/2,lb["y"]+lb["height"]/2,21,0,alt=True)
    check("Holding Option moves freely (no snapping)", "lined up" not in pg.locator(".ctx").inner_text())
    before=look(pg,"Outcomes","figure-label-0").get("desktop",{}).get("y",0); pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(500)
    check("Arrow keys move 4 px", abs(look(pg,"Outcomes","figure-label-0").get("desktop",{}).get("y",0)-before-0.25)<0.01)
    pg.locator(".editor-screens button",has_text="Phone").click(); pg.wait_for_timeout(1500)
    check("Phone shows Desktop's move until changed there", frame(pg).locator("#outcomes [data-el='figure-label-0']").first.evaluate("e=>parseFloat(getComputedStyle(e).left)")>0)
    check("Off Desktop, the strip says changes apply to that size only", "apply to phones only" in pg.locator(".editor-strip").inner_text())
    pg.locator(".editor-screens button",has_text="Desktop").click(); pg.wait_for_timeout(1500)
    # ---- 3 Keyboard and accessibility
    fresh(pg); f=frame(pg)
    pick(pg,"#outcomes [data-el='skills-label']")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    check("Enter starts typing on the selected words", f.locator(".el-typing").count()==1)
    pg.keyboard.type("XYZ"); pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("Esc cancels typing and changes nothing", f.locator(".el-typing").count()==0 and not unsaved(pg).get("root",{}).get("props",{}).get("edits"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("Esc then deselects", "Outcomes" in pg.locator(".ctx .ctx-name").inner_text())
    pg.locator(".ctx button",has_text="settings").first.click(); pg.wait_for_timeout(600)
    parts=pg.locator(".el-parts button:visible")
    check("A section lists its parts, so each can be chosen by keyboard", parts.count()>=4)
    parts.nth(1).focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
    check("Choosing a part selects it on the page", frame(pg).locator("[data-el-selected]").count()==1)
    v=axe(pg); check("Accessibility: element selected with settings open (no serious issues)", not v, str(v)[:200])
    pg.get_by_role("button",name="Publish").first.click(); pg.wait_for_timeout(4500)
    v=axe(pg); check("Accessibility: publish dialog (no serious issues)", not v, str(v)[:200]); pg.keyboard.press("Escape")
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    v=axe(pg); check("Accessibility: opening screen (no serious issues)", not v, str(v)[:200])
    small=pg.evaluate("[...document.querySelectorAll('.editor-bar button, .ctx button')].filter(b=>b.offsetParent&&(b.getBoundingClientRect().height<24||b.getBoundingClientRect().width<24)).map(b=>b.getAttribute('aria-label')||b.textContent.trim())")
    check("Every top bar and toolbar control is at least 24 px", not small, str(small))
    pg.keyboard.press("Tab"); pg.keyboard.press("Tab")
    check("Focus is clearly visible", pg.evaluate("getComputedStyle(document.activeElement).outlineStyle")!="none")
    # ---- 4 One visual language
    fonts=pg.evaluate("[...new Set([...document.querySelectorAll('.editor-bar, .ctx, [class*=PuckLayout] button, [class*=Puck] h2')].map(e=>getComputedStyle(e).fontFamily.split(',')[0]))]")
    check("One typeface across the editor", all("Instrument" in x for x in fonts), str(fonts))
    blue=pg.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.offsetParent&&/rgb\\(\\s*0?\\s*,?\\s*(9[0-9]|1[0-2][0-9])\\s*,\\s*2[0-9][0-9]\\)|rgb\\(4[0-9], 1[0-4][0-9], 2[0-9][0-9]\\)/.test(getComputedStyle(e).color)).length")
    check("No leftover library blue", blue==0, str(blue))
    ctx.close()
    # ---- 5 Responsive editor
    for name,w,h in (("Large desktop",1920,1080),("Small desktop",1280,800),("iPad landscape",1024,768),("iPad portrait",768,1024),("Phone",390,844)):
        c2=b.new_context(viewport={"width":w,"height":h},has_touch=w<1100,is_mobile=w<500); q=c2.new_page(); q.on("pageerror",lambda e: errs.append(str(e)))
        fresh(q)
        ok_w=q.evaluate("document.documentElement.scrollWidth<=innerWidth")
        vis=q.evaluate("['.editor-save','.editor-bar .editor-primary','.editor-screens'].every(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.width>0&&r.right<=innerWidth+1&&r.bottom<=innerHeight})")
        h0=q.evaluate("document.querySelector('.editor-bar').getBoundingClientRect().height")
        el=frame(q).locator("#outcomes [data-el='skills-label']").first; el.scroll_into_view_if_needed(); q.wait_for_timeout(300); bb=el.bounding_box(); q.mouse.click(bb["x"]+4,bb["y"]+bb["height"]/2); q.wait_for_timeout(700)
        h1=q.evaluate("document.querySelector('.editor-bar').getBoundingClientRect().height")
        sel=frame(q).locator("[data-el-selected]").count()==1
        check(f"{name}: no overflow, Save and Publish in view, steady bar, selection works", ok_w and vis and abs(h1-h0)<2 and sel, f"overflow ok {ok_w}, visible {vis}, bar {h0:.0f}->{h1:.0f}, selected {sel}")
        c2.close()
    check("No script errors", not errs, "; ".join(errs[:2]))
    print(f"{sum(1 for _,o in res if o)} of {len(res)} passed"); b.close()
