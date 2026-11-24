# Round 4: your everyday tasks, start to finish in one fresh session, then the same editor at every
# screen width you asked for. Each task is done the way the user guide describes it. Run from the
# repository root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
from playwright.sync_api import sync_playwright
URL = "http://localhost:4302/admin/design/?project=about-face-beauty"
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def centre(l): b = l.bounding_box(); return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
def unsaved(pg): return pg.evaluate("JSON.parse(localStorage.getItem('design-editor:about-face-beauty:unsaved')||'null')")
def look(pg, block, key):
    for it in (unsaved(pg) or {}).get("content", []):
        if it["type"] == block: return (it["props"].get("elements") or {}).get(key)
def names(pg): return pg.locator(".sec-row .sec-name").all_inner_texts()
def status(pg): return pg.locator(".editor-status").inner_text()
def open_sections(pg):
    if not pg.locator(".sec-panel:visible").count(): pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(600)

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []
    pg = br.new_page(viewport={"width": 1440, "height": 900}); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    f = frame(pg)
    check("Start: the status says Same as the website", status(pg) == "Same as the website", status(pg))

    # 1. Find a particular section: Outcomes.
    open_sections(pg)
    pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Outcomes")).locator(".sec-go").click(); pg.wait_for_timeout(900)
    check("1 Find Outcomes: two clicks, and the page is there", pg.locator(".editor-bar-ctx").inner_text().startswith("Outcomes") and frame(pg).evaluate("document.querySelector('#outcomes').getBoundingClientRect().top < innerHeight"))

    # 2. Reorder two sections: The work above Research & thinking, by dragging.
    w = pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="The work"))
    w.locator(".sec-grip").drag_to(pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Research & thinking"))); pg.wait_for_timeout(700)
    check("2 Reorder: The work now comes before Research & thinking", names(pg).index("The work") < names(pg).index("Research & thinking"), str(names(pg)[5:9]))

    # 3. Add a space and a text section (photos are added in the website editor).
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    pg.locator(".sec-option", has_text="Space").click(); pg.wait_for_timeout(900)
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    pg.locator(".sec-option", has_text="A heading and a paragraph").click(); pg.wait_for_timeout(900)
    n = names(pg)
    check("3 Add a space and a text section: both listed, in order", "Space" in n and "Text: Heading" in n and n.index("Text: Heading") == n.index("Space") + 1, str(n))

    # 4. Understand what each kind does: every option says so in a sentence, with a picture.
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    hints = pg.locator(".sec-option .sec-hint").all_inner_texts()
    check("4 Every kind to add is described in a sentence", len(hints) >= 3 and all(len(h.split()) >= 4 for h in hints), str(hints[:3]))
    pg.get_by_role("tab", name="On this page").click(); pg.wait_for_timeout(300)

    # 5. Select one element and edit its words (the new text section's heading).
    f = frame(pg); h = f.locator("[data-puck-component^='Text'] [data-el='heading']").first; h.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    b = h.bounding_box(); pg.mouse.dblclick(b["x"] + 6, b["y"] + b["height"] / 2); pg.wait_for_timeout(500)
    pg.keyboard.press("ControlOrMeta+a"); pg.keyboard.type("What I learned"); pg.keyboard.press("Enter"); pg.wait_for_timeout(800)
    texts = [i["props"].get("heading") for i in unsaved(pg)["content"] if i["type"] == "Text"]
    check("5 Edit words on the page: the new heading is saved", "What I learned" in texts, str(texts))
    check("…and the list shows the new name", "Text: What I learned" in names(pg), str(names(pg)))

    # 6. Move and resize an image (the opening cover).
    f = frame(pg); img = f.locator(".cs-open-visual").first; img.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    x, y = centre(img); pg.mouse.click(x, y); pg.wait_for_timeout(500)
    pg.mouse.move(x, y); pg.mouse.down()
    for i in range(1, 16): pg.mouse.move(x - 3 * i, y + i); pg.wait_for_timeout(15)
    pg.mouse.up(); pg.wait_for_timeout(700)
    hx, hy = centre(f.locator(".el-frame .el-handle")); pg.mouse.move(hx, hy); pg.mouse.down()
    for i in range(1, 16): pg.mouse.move(hx + 3 * i, hy); pg.wait_for_timeout(15)
    pg.mouse.up(); pg.wait_for_timeout(700)
    d = (look(pg, "Opening", "image") or {}).get("desktop", {})
    check("6 Move and resize an image", d.get("x", 0) < 0 and (d.get("width") or d.get("cover")), str(d))

    # 7. Switch between Desktop, Tablet and Phone; a Phone change stays on Phone.
    pg.locator(".editor-screens button", has_text="Phone").click(); pg.wait_for_timeout(1500)
    check("7 Phone shows the page at phone width", 380 <= frame(pg).evaluate("innerWidth") <= 400, str(frame(pg).evaluate("innerWidth")))
    check("…and the Sections panel stays open", pg.locator(".sec-panel:visible").count() == 1)
    pg.locator(".editor-screens button", has_text="Tablet").click(); pg.wait_for_timeout(1200)
    pg.locator(".editor-screens button", has_text="Desktop").click(); pg.wait_for_timeout(1200)
    check("…and back to Desktop", frame(pg).evaluate("innerWidth") >= 1200)

    # 8. Undo and Redo, reading what each will do.
    before = len(unsaved(pg)["content"])
    label = pg.locator(".editor-history button").first.get_attribute("aria-label") or ""
    pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(700)
    pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(700)
    pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(700)
    check("8 Undo three times takes back the image move, resize and the new words", (look(pg, "Opening", "image") or {}).get("desktop", {}).get("x", 0) == 0, label)
    pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(700)
    check("…Redo puts the words back", "What I learned" in [i["props"].get("heading") for i in unsaved(pg)["content"] if i["type"] == "Text"])
    check("…and the page still has the new sections", len(unsaved(pg)["content"]) == before)

    # 9. Is it saved? The status says so in words; a draft survives a reload.
    check("9 With changes, the status says Not saved yet", status(pg) == "Not saved yet", status(pg))
    pg.locator(".editor-save").click(); pg.wait_for_timeout(1200)
    check("…Save draft says Draft saved, not published", status(pg).startswith("Draft saved"), status(pg))
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500); open_sections(pg)
    check("…after a reload: still saved, and every change is there", status(pg).startswith("Draft saved") and "Text: What I learned" in names(pg) and names(pg).index("The work") < names(pg).index("Research & thinking"), status(pg))
    pg.close()

    # 10. The editor at every width you asked for: nothing runs off the screen, the main controls are
    #     there and large enough, and the Sections panel opens and fits.
    for w, h in [(1920, 1080), (1440, 900), (1280, 800), (1024, 768), (768, 1024), (390, 844), (375, 667)]:
        q = br.new_page(viewport={"width": w, "height": h}); q.on("pageerror", lambda e: errors.append(str(e)))
        q.goto(URL, wait_until="networkidle"); q.evaluate("localStorage.clear()"); q.reload(wait_until="networkidle"); q.wait_for_timeout(2500)
        over = q.evaluate("document.documentElement.scrollWidth - innerWidth")
        need = ["Publish", "Undo", "Redo", "Desktop", "Tablet", "Phone"]
        seen = [n for n in need if q.get_by_role("button", name=n).first.is_visible()]
        small = q.evaluate("""() => [...document.querySelectorAll('.editor-bar button, .sec-panel button')].filter(b => b.offsetParent).filter(b => { const r = b.getBoundingClientRect(); return r.height < 24 || r.width < 24 }).map(b => b.innerText || b.getAttribute('aria-label')).slice(0, 5)""")
        open_sections(q)
        panel = q.locator(".sec-panel:visible")
        fits = panel.count() == 1 and panel.bounding_box()["width"] <= w
        check(f"{w}px: no sideways scrolling, main controls visible, Sections opens and fits", over <= 0 and len(seen) == len(need) and fits, f"overflow {over}, missing {set(need) - set(seen)}, fits {fits}")
        check(f"{w}px: no editor button smaller than 24px", not small, str(small))
        q.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
