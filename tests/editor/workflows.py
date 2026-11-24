# Complete editing workflows on real portfolio pages, as a person would do them: several kinds of change
# on one part, then undo, redo, reset, saving and reloading. Run from the repository root after
# `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import re, math
_here = __file__.replace("workflows.py", "")
exec(open(_here + "notes.py").read().split("\nwith sync_playwright() as p:")[0])
exec(open(_here + "round2.py").read().split("\nwith sync_playwright() as p:")[0].split("\n", 5)[5])

def look(f, sel, prop): return f.evaluate(f"getComputedStyle(document.querySelector(\"{sel}\")).{prop}")
def undo(pg): pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(700)  # the unsaved copy is written 0.4 s after a change
def redo(pg): pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(700)

def more(pg, item):
    pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(300)
    pg.locator(".ctx-more-menu button", has_text=item).first.click(); pg.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    errors = []

    # 1. AF-Binary cover: turn, enlarge with the handle, nudge, then undo everything and redo it.
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, ".cs-open-visual")
    start = (tilt(f), look(f, ".cs-open-visual", "maxWidth"), look(f, ".cs-open-visual", "left"))
    turn(pg, f, 5)
    h = f.locator(".el-frame .el-handle").bounding_box()
    pg.mouse.move(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2); pg.mouse.down(); pg.mouse.move(h["x"] - 90, h["y"] + 10, steps=8); pg.mouse.up(); pg.wait_for_timeout(500)
    frame_click(pg, f); keys(pg, "ArrowLeft", 4); pg.wait_for_timeout(500)
    o = own(pg, "about-face-beauty", "image", "desktop")
    check("Turn, resize and move all apply to the cover", o.get("rotate") and o.get("cover") in ("large", "xl") and o.get("x"), str(o))
    check("The rotate handle is still on the turned, larger cover", f.locator(".el-frame .el-rotate").is_visible())
    labels = []
    for _ in range(6):
        if pg.locator(".editor-history button").first.is_disabled(): break
        labels.append(pg.locator(".editor-history button").first.get_attribute("aria-label")); undo(pg)
    back = (tilt(f), look(f, ".cs-open-visual", "maxWidth"), look(f, ".cs-open-visual", "left"))
    check("Undo steps back through each change, named", any("move" in l for l in labels) and any("resize" in l for l in labels) and any("turn" in l for l in labels), " / ".join(labels))
    check("Undoing everything restores the cover exactly", back == start, f"{start} -> {back}")
    for _ in range(len(labels)):
        redo(pg)
    check("Redo brings every change back", own(pg, "about-face-beauty", "image", "desktop") == o, str(own(pg, "about-face-beauty", "image", "desktop")))
    pg.locator(".editor-save").click(); pg.wait_for_timeout(600)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500); f = frame(pg)
    check("After saving and reloading, the cover is as left and shows Draft saved", tilt(f) == f"{o['rotate']:g}deg" and pg.locator(".editor-status").inner_text().startswith("Draft saved"), pg.locator(".editor-status").inner_text())
    pg.close()

    # 2. AF-Binary gallery image: width typed, crop focus, angle, then one Reset and its Undo.
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, "[data-el='image-0']")
    w = pg.locator(".ctx input[aria-label='Width in per cent']"); w.click(); w.fill("60"); w.press("Enter"); pg.wait_for_timeout(700)
    a = pg.locator(angle_field); a.click(); a.fill("3"); a.press("Enter"); pg.wait_for_timeout(700)
    pg.get_by_role("button", name=re.compile("^(All )?[Ss]ettings$")).click(); pg.wait_for_timeout(700)
    focus = pg.locator(".el-focus button:visible")
    if focus.count(): focus.first.click(); pg.wait_for_timeout(700)
    o = own(pg, "about-face-beauty", "image-0", "desktop")
    check("Width, angle and crop focus combine on one image", o.get("width") == 60 and o.get("rotate") == 3 and ("focusX" in o or focus.count() == 0), str(o))
    pg.locator(".el-reset:visible").click(); pg.wait_for_timeout(700)
    check("One Reset clears them all at this size", own(pg, "about-face-beauty", "image-0", "desktop") == {}, str(own(pg, "about-face-beauty", "image-0", "desktop")))
    undo(pg)
    check("Undo after Reset brings them all back", own(pg, "about-face-beauty", "image-0", "desktop") == o)
    pg.close()

    # 3. Phone only: hide the summary line on Phone; Desktop keeps it; layout notes stay quiet.
    pg, f, errs = open_editor(br, "fc-yeah", 1440, 900); errors += errs
    pg.get_by_role("button", name="Phone").first.click(); pg.wait_for_timeout(1400); f = frame(pg)
    click(pg, f, "[data-el='line']"); more(pg,"Hide on"); pg.wait_for_timeout(1700)
    check("Hidden on Phone only", own(pg, "fc-yeah", "line", "phone").get("hidden") is True and not own(pg, "fc-yeah", "line", "desktop"))
    check("No layout notes for hiding a part", pg.locator(chip).count() == 0)
    pg.get_by_role("button", name="Desktop").first.click(); pg.wait_for_timeout(1400); f = frame(pg)
    check("Desktop still shows it", look(f, "[data-el='line']", "display") != "none")
    pg.close()

    # 4. Rotate handle near the top of the page moves below the image, within reach.
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, ".cs-open-visual")
    f.evaluate("document.querySelector('.cs-open-visual').closest('[data-puck-component]').style.paddingTop = '0px'; window.scrollTo(0, 0)")
    f.evaluate("window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(400)
    top = f.evaluate("document.querySelector('.cs-open-visual').getBoundingClientRect().top + scrollY")
    rb = f.locator(".el-frame .el-rotate").bounding_box()
    check("Near the page top the rotate handle sits below the image", top > 48 or (f.locator(".el-frame[data-rotate-below]").count() == 1 and rb["y"] > 0), f"top {top:.0f}, handle y {rb['y']:.0f}")
    pg.close()

    # 5. A suggestion shows what it measures against before it is applied.
    for name, key, n, kinds in (("edge", "ArrowRight", 2, ["el-preview-ghost", "el-preview-line"]), ("spacing", "Shift+ArrowDown", 3, ["el-preview-ghost", "el-preview-gap"])):
        pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
        click(pg, f, "[data-el='line']"); frame_click(pg, f); keys(pg, key, n); pg.wait_for_timeout(2200)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200); pg.locator(chip).click(); pg.wait_for_timeout(300)
        li = pg.locator(".editor-notes-list li").first
        text = li.inner_text()
        check(f"The {name} suggestion names the part it is measured against", (" of Category and year line" in text) if name == "edge" else (", below Title" in text), text.split(chr(10))[0])
        li.hover(); pg.wait_for_timeout(500)
        parts = f.evaluate("[...document.querySelectorAll('.el-preview > div')].map(d => d.className)")
        check(f"Pointing at it shows the target and the {name} reference on the page", parts == kinds, str(parts))
        pg.mouse.move(700, 120); pg.wait_for_timeout(300)
        check("Moving away clears it", f.locator(".el-preview").count() == 0)
        pg.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
