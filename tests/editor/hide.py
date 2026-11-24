from playwright.sync_api import sync_playwright
def frame(pg): return [f for f in pg.frames if f!=pg.main_frame][0]
res=[]
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ")+n+(f"  [{d}]" if d else ""))
def look(pg):
    d=pg.evaluate("JSON.parse(localStorage.getItem('design-editor:about-face-beauty:unsaved')||'null')") or {}
    for it in d.get("content",[]):
        if it["type"]=="Outcomes": return (it["props"].get("elements") or {}).get("skills-label",{})
    return {}
def more(pg, item):
    pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(300)
    pg.locator(".ctx-more-menu button", has_text=item).first.click(); pg.wait_for_timeout(500)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900})
    pg.goto("http://localhost:4302/admin/design/?project=about-face-beauty",wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    pg.locator(".editor-screens button",has_text="Phone").click(); pg.wait_for_timeout(1500)
    f=frame(pg); l=f.locator("#outcomes [data-el='skills-label']").first; l.scroll_into_view_if_needed(); b0=l.bounding_box(); pg.mouse.click(b0["x"]+6,b0["y"]+b0["height"]/2); pg.wait_for_timeout(600)
    more(pg,"Hide on"); pg.wait_for_timeout(300)
    lk=look(pg); op=f.locator("#outcomes [data-el='skills-label']").first.evaluate("e=>getComputedStyle(e).opacity")
    check("Hide on Phone saves for Phone only", lk.get("phone",{}).get("hidden") is True and "desktop" not in lk, str(lk))
    check("In the editor it stays visible, faded, so it can be found", op=="0.3", op)
    pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(300)
    check("The More menu shows it as hidden, with words", pg.locator(".ctx-more-menu .ctx-hide").get_attribute("aria-pressed")=="true" and "show it" in pg.locator(".ctx-more-menu .ctx-hide").inner_text())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.get_by_role("button",name="Preview").click(); pg.wait_for_timeout(800)
    disp=frame(pg).locator("#outcomes [data-el='skills-label']").first.evaluate("e=>getComputedStyle(e).display")
    check("Preview on Phone leaves it out", disp=="none", disp)
    pg.get_by_role("button",name="Back to editing").click(); pg.wait_for_timeout(600)
    pg.locator(".editor-screens button",has_text="Desktop").click(); pg.wait_for_timeout(1500)
    op=frame(pg).locator("#outcomes [data-el='skills-label']").first.evaluate("e=>getComputedStyle(e).opacity")
    check("Desktop still shows it normally", op=="1", op)
    pg.locator(".editor-screens button",has_text="Phone").click(); pg.wait_for_timeout(1500)
    f=frame(pg); l=f.locator("#outcomes [data-el='skills-label']").first; l.scroll_into_view_if_needed(); b0=l.bounding_box(); pg.mouse.click(b0["x"]+6,b0["y"]+b0["height"]/2); pg.wait_for_timeout(600)
    more(pg,"show it"); pg.wait_for_timeout(300)
    check("Showing it again removes the setting", not look(pg).get("phone",{}).get("hidden"), str(look(pg)))
    print(f"{sum(res)} of {len(res)} passed"); b.close()
