# Layout notes and the Tablet and Phone reminder. Run from the repository root after
# `bun run build:preview` and `python3 tests/editor/serve.py dist 4302 &`.
import json
from playwright.sync_api import sync_playwright
BASE = "http://localhost:4302/admin/design/?project="
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""))
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def saved(pg, slug):
    return json.loads(pg.evaluate(f"localStorage.getItem('design-editor:{slug}:unsaved')") or "null") or {}
def open_editor(br, slug, w=1440, h=900):
    pg = br.new_page(viewport={"width": w, "height": h}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + slug, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    return pg, frame(pg), errs
def click(pg, f, sel):
    l = f.locator(sel).first; l.scroll_into_view_if_needed(); pg.wait_for_timeout(200); b = l.bounding_box()
    pg.mouse.click(b["x"] + 6, b["y"] + b["height"] / 2); pg.wait_for_timeout(400)
def checks_run(f): return int(f.evaluate("document.documentElement.dataset.layoutChecks || 0"))
chip = ".editor-notes-btn"

with sync_playwright() as p:
    br = p.chromium.launch()
    # 1. No noise: pages you have not changed have no notes, at any size.
    for slug in ["about-face-beauty", "cancel-me-not", "fc-yeah", "evoke", "bersih"]:
        for w, scr in ((1440, "Desktop"), (1024, "Tablet"), (390, "Phone")):
            pg, f, errs = open_editor(br, slug, w)
            pg.wait_for_timeout(1500)
            check(f"No notes on unchanged {slug} at {scr}", pg.locator(chip).count() == 0 and not errs, str(errs[:1]))
            pg.close()

    pg, f, errs = open_editor(br, "about-face-beauty")
    # 2. Approved exception: restyling text on AF-Binary's Sage opening gives no contrast note.
    click(pg, f, "[data-el='line']")
    pg.locator(".ctx button[aria-label='Larger text']").click(); pg.wait_for_timeout(2500)
    txt = pg.locator(chip).inner_text() if pg.locator(chip).count() else ""
    check("Approved Sage exception is not reported", "hard to read" not in pg.evaluate("document.querySelector('.editor-notes-list')?.innerText || ''") and pg.locator(chip).count() == 0, txt)
    # 3. Reminder after a Desktop change
    check("Desktop change shows the Tablet and Phone reminder", pg.locator(".editor-notes-hint", has_text="Desktop changes also apply").count() == 1)
    pg.keyboard.press("ControlOrMeta+z"); pg.wait_for_timeout(600)

    # 4. Move a part off the page: a note appears, the part is marked, nothing is moved back.
    click(pg, f, "#outcomes [data-el='skills-label']")
    fb = f.locator(".el-frame").bounding_box(); pg.mouse.click(fb["x"] + fb["width"] / 2, fb["y"] + fb["height"] / 2)
    for _ in range(80): pg.keyboard.press("Shift+ArrowRight")
    pg.wait_for_timeout(2500)
    label = pg.locator(chip).inner_text() if pg.locator(chip).count() else ""
    check("Moving a part off the page gives a layout note", "layout note" in label, label)
    check("The part is faintly marked on the page", f.locator("[data-el='skills-label'][data-el-note]").count() == 1)
    x = (saved(pg, "about-face-beauty").get("content") or [])
    moved = [it for it in x if it["type"] == "Outcomes"][0]["props"].get("elements", {}).get("skills-label", {}).get("desktop", {}).get("x")
    check("Nothing is moved back automatically", moved and moved > 10, str(moved))
    ms = float(f.evaluate("document.documentElement.dataset.layoutCheckMs || 999"))
    check("A check takes under 30 ms", ms < 30, f"{ms} ms")

    # 5. The list, by keyboard: open with Enter, notes have Show and This is intended, Escape closes.
    pg.locator(chip).focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    items = pg.locator(".editor-notes-list li").all_inner_texts()
    check("Keyboard opens the list; notes name the size and the problem", pg.locator(".editor-notes-list").count() == 1 and any("Desktop:" in i and "Outcomes" not in i for i in items), " | ".join(i.split("\n")[0] for i in items))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Escape closes the list", pg.locator(".editor-notes-list").count() == 0)

    # 6. This is intended: per part and size, saved with the page, reversible, undoable.
    pg.locator(chip).click(); pg.wait_for_timeout(200)
    before = len(items)
    pg.locator(".editor-notes-list li button", has_text="This is intended").first.click(); pg.wait_for_timeout(600)
    root = saved(pg, "about-face-beauty").get("root", {}).get("props", {})
    check("This is intended is saved with the page, for this part and size", len(root.get("intended", [])) == 1 and "|desktop|" in root["intended"][0]["id"], str(root.get("intended")))
    after = pg.locator(".editor-notes-list section li").count()
    check("That note goes quiet", after == before - 1, f"{before} -> {after}")
    pg.locator(".editor-notes-intended summary").click(); pg.wait_for_timeout(200)
    pg.locator(".editor-notes-intended button", has_text="Show this note again").click(); pg.wait_for_timeout(600)
    check("It can be reversed from the list", pg.locator(".editor-notes-list section li").count() == before and not saved(pg, "about-face-beauty")["root"]["props"].get("intended"))
    pg.keyboard.press("Escape")

    # 7. Check Tablet and Phone on request; Show goes to that size and selects the part.
    hint = pg.locator(".editor-notes-hint button", has_text="Check Tablet and Phone")
    check("Reminder offers to check Tablet and Phone", hint.count() == 1)
    hint.click(); pg.wait_for_timeout(5000)
    lst = pg.locator(".editor-notes-list li").all_inner_texts()
    check("Tablet and Phone are checked and listed", any(i.startswith("Tablet:") for i in lst) and any(i.startswith("Phone:") for i in lst), " | ".join(i.split("\n")[0][:60] for i in lst))
    check("The preview returns to Desktop afterwards", pg.evaluate("document.getElementById('preview-frame').getBoundingClientRect().width") > 1000)
    pg.locator(".editor-notes-list li", has_text="Phone:").first.locator("button", has_text="Show").click(); pg.wait_for_timeout(1500)
    check("Show switches to Phone and selects the part", pg.evaluate("document.getElementById('preview-frame').contentDocument.documentElement.clientWidth") < 500 and f.locator("[data-el-selected]").count() == 1)

    # 7b. Notes and the reminder never move the page: the bar keeps its height at every width.
    for w in (1920, 1280, 1024, 390):
        q, g, _ = open_editor(br, "about-face-beauty", w)
        bar0 = q.locator(".editor-bar").bounding_box()["height"]; frame0 = q.locator("#preview-frame").bounding_box()["y"]
        click(q, g, "#outcomes [data-el='skills-label']")
        fb = g.locator(".el-frame").bounding_box(); q.mouse.click(fb["x"] + fb["width"] / 2, fb["y"] + fb["height"] / 2)
        for _ in range(60): q.keyboard.press("Shift+ArrowRight")
        q.wait_for_timeout(2500)
        bar1 = q.locator(".editor-bar").bounding_box()["height"]; frame1 = q.locator("#preview-frame").bounding_box()["y"]
        check(f"At {w}px the notes and reminder do not move the page", abs(bar1 - bar0) < 1 and abs(frame1 - frame0) < 1 and q.evaluate("document.documentElement.scrollWidth<=innerWidth"), f"bar {bar0:.0f}->{bar1:.0f}, page top {frame0:.0f}->{frame1:.0f}")
        q.close()

    # 8. No checks while typing.
    pg.goto(BASE + "about-face-beauty", wait_until="networkidle"); pg.wait_for_timeout(2500); f = frame(pg)
    l = f.locator("#outcomes [data-el='skills-label']").first; l.scroll_into_view_if_needed(); b = l.bounding_box()
    pg.mouse.dblclick(b["x"] + 6, b["y"] + b["height"] / 2); pg.wait_for_timeout(300)
    n0 = checks_run(f); pg.keyboard.type("Skills used", delay=60); pg.wait_for_timeout(2000); n1 = checks_run(f)
    check("No checks run while typing", n1 == n0, f"{n0} -> {n1}")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(1500)
    check("No script errors", not errs, str(errs[:2]))
    pg.close()
    print(f"{sum(res)} of {len(res)} passed"); br.close()
