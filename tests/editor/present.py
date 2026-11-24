# Round 5: presenting the photo in an Image section. The photo is its own part ("Photo"): Size
# (the four widths), a width per screen size, Shape (its own shape or a fixed one), Fit (only for a
# fixed shape), Crop focus (only when filling a fixed shape), the note when a photo would look soft,
# Reset, Undo and Redo, phones, keyboard and accessibility. The photo file is never changed.
# Run from the repository root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import json, os, re
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = os.environ.get("EDITOR_URL", "http://localhost:4302/admin/design/?project=about-face-beauty")
AXE = os.environ.get("AXE") or next((p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p)), None)
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def unsaved(pg): return pg.evaluate("JSON.parse(localStorage.getItem('design-editor:about-face-beauty:unsaved')||'null')")
def section(pg):
    for i in (unsaved(pg) or {}).get("content", []):
        if i["type"] == "Image": return i["props"]
    return {}
def fresh(br, w=1440, h=900):
    pg = br.new_page(viewport={"width": w, "height": h}, bypass_csp=True); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    if not pg.locator(".sec-panel:visible").count(): pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(600)
    return pg, errs
from seed import seed, image, PHOTOS
def add_photo(pg, name): seed(pg, [image(PHOTOS[name])])
def select_photo(pg):
    ph = frame(pg).locator(".free-photo").first; ph.scroll_into_view_if_needed(); pg.wait_for_timeout(300); b = ph.bounding_box()
    pg.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2); pg.wait_for_timeout(700)
    if not pg.locator("section.el-group[aria-label='Look: Photo']:visible").count():
        pg.get_by_role("button", name=re.compile("^(All )?[Ss]ettings$")).first.click(); pg.wait_for_timeout(600)
def panel(pg): return pg.locator("section.el-group[aria-label='Look: Photo']:visible").first
def img(pg): return frame(pg).evaluate("""() => { const i = document.querySelector('.free-photo img'); const f = i.closest('figure'); const c = getComputedStyle(i)
    return { w: i.getBoundingClientRect().width, h: i.getBoundingClientRect().height, nat: i.naturalWidth / i.naturalHeight, fit: c.objectFit, pos: c.objectPosition,
             fig: f.getBoundingClientRect().width, cls: f.className, box: i.parentElement.getBoundingClientRect().width } }""")
def undo(pg): pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(600)
def redo(pg): pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(600)
def screen(pg, name): pg.get_by_role("button", name=re.compile("^" + name)).first.click(); pg.wait_for_timeout(800)

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []

    # 1. The photo is its own part, with the photo's controls; fit and crop wait until they mean something.
    pg, e = fresh(br); errors += e
    add_photo(pg, "brand proposal cover art")
    select_photo(pg)
    check("Clicking the photo selects it as Photo", pg.locator(".ctx-name").first.inner_text() == "Photo")
    g = panel(pg)
    check("The settings show a Photo group with Size, Width on this screen and Shape", g.count() == 1 and all(g.get_by_text(t, exact=True).count() for t in ["Size", "Width on this screen", "Shape"]))
    check("Its own shape is the default", g.get_by_label("Shape", exact=True).input_value() == "auto")
    check("Fit and Crop focus are hidden while the photo keeps its own shape", g.get_by_text("Fit", exact=True).count() == 0 and g.get_by_text("Crop focus", exact=True).count() == 0)
    s = img(pg)
    check("Its own shape: the photo is shown whole, undistorted", abs(s["w"] / s["h"] - s["nat"]) < 0.02, str(s))

    # 2. Size: the four widths, as the space the photo can fill.
    widths = {}
    for name, cls in [("Narrow", "d-w-narrow"), ("Text column", "d-w-text"), ("Wide", "d-w-wide"), ("Full", None)]:
        panel(pg).get_by_role("button", name=name, exact=True).click(); pg.wait_for_timeout(500)
        s = img(pg); widths[name] = round(s["fig"])
        ok = (cls in s["cls"]) if cls else not any(c in s["cls"] for c in ["d-w-narrow", "d-w-text", "d-w-wide"])
        check(f"Size {name} sets the photo's space", ok and panel(pg).get_by_role("button", name=name, exact=True).get_attribute("aria-pressed") == "true", f"{s['cls']} {s['fig']:.0f}px")
    check("Narrow < Text column < Wide < Full", widths["Narrow"] < widths["Text column"] < widths["Wide"] < widths["Full"], str(widths))
    undo(pg)
    check("Undo takes the size back one step (Wide)", "d-w-wide" in img(pg)["cls"])
    redo(pg)
    check("Redo puts it back (Full)", "d-w-wide" not in img(pg)["cls"])
    panel(pg).get_by_role("button", name="Text column", exact=True).click(); pg.wait_for_timeout(400)

    # 3. Width on this screen: a share of that space, per screen size; Reset clears it.
    panel(pg).get_by_label("Width in per cent").fill("60"); panel(pg).get_by_label("Width in per cent").press("Enter"); pg.wait_for_timeout(600)
    s = img(pg)
    check("Desktop: width 60% of the space", abs(s["box"] / s["fig"] - 0.6) < 0.02, f"{s['box']:.0f}/{s['fig']:.0f}")
    screen(pg, "Phone"); select_photo(pg)
    check("Phone follows Desktop until set (shown as from a larger screen)", panel(pg).locator(".el-from").count() >= 1)
    panel(pg).get_by_label("Width in per cent").fill("100"); panel(pg).get_by_label("Width in per cent").press("Enter"); pg.wait_for_timeout(600)
    s = img(pg)
    check("Phone: its own width (100%), filling the phone's column", abs(s["box"] / s["fig"] - 1) < 0.02, f"{s['box']:.0f}/{s['fig']:.0f}")
    els = section(pg).get("elements", {}).get("photo", {})
    check("Desktop and Phone widths are stored separately", els.get("desktop", {}).get("width") == 60 and els.get("phone", {}).get("width") == 100, json.dumps(els))
    screen(pg, "Desktop"); select_photo(pg)
    check("Desktop is unchanged by the Phone setting", abs(img(pg)["box"] / img(pg)["fig"] - 0.6) < 0.02)
    panel(pg).get_by_role("button", name="Width on this screen: back to as designed").click(); pg.wait_for_timeout(600)
    check("Reset puts the Desktop width back (fills its space)", abs(img(pg)["box"] / img(pg)["fig"] - 1) < 0.02 and "width" not in section(pg).get("elements", {}).get("photo", {}).get("desktop", {}))

    # 4. Shape: a fixed shape crops to fill; Fit and Crop focus appear.
    panel(pg).get_by_label("Shape", exact=True).select_option("1/1"); pg.wait_for_timeout(600)
    s = img(pg)
    check("Square: the frame is 1:1 and the photo fills it", abs(s["w"] / s["h"] - 1) < 0.02 and s["fit"] == "cover", str(s))
    check("Fit and Crop focus now appear", panel(pg).get_by_text("Fit", exact=True).count() == 1 and panel(pg).get_by_text("Crop focus", exact=True).count() == 1)
    panel(pg).get_by_role("button", name="Focus top left").click(); pg.wait_for_timeout(500)
    check("Crop focus top left keeps the top-left part in view", img(pg)["pos"] in ("0% 0%", "0px 0px"), img(pg)["pos"])
    for r in ["4/5", "3/4", "9/16", "16/9", "21/9"]:
        panel(pg).get_by_label("Shape", exact=True).select_option(r); pg.wait_for_timeout(400)
        a, b = map(int, r.split("/")); s = img(pg)
        check(f"Shape {r} draws a {r} frame", abs(s["w"] / s["h"] - a / b) < 0.02, f"{s['w']:.0f}x{s['h']:.0f}")
    panel(pg).get_by_label("Shape", exact=True).select_option("1/1"); pg.wait_for_timeout(400)

    # 5. Fit: show the whole photo inside the frame; Crop focus goes away because nothing is cropped.
    panel(pg).get_by_role("button", name="Show the whole photo").click(); pg.wait_for_timeout(500)
    s = img(pg)
    check("Show the whole photo: nothing cropped (contain), frame still square", s["fit"] == "contain" and abs(s["w"] / s["h"] - 1) < 0.02, str(s))
    check("Crop focus is hidden when nothing is cropped", panel(pg).get_by_text("Crop focus", exact=True).count() == 0)
    check("Shape and fit are stored on the section", section(pg).get("ratio") == "1/1" and section(pg).get("fit") == "contain")
    label = pg.locator(".editor-history button").first.get_attribute("aria-label") or ""
    check("Undo names the step: change how Photo fits", "change how photo fits" in label.lower(), label)
    undo(pg)
    check("Undo returns to Fill the frame", img(pg)["fit"] == "cover" and section(pg).get("fit") in (None, "cover"))
    redo(pg)

    # 6. Back to its own shape: fit no longer applies, so the whole photo shows undistorted again.
    panel(pg).get_by_role("button", name="Shape: back to as designed").click(); pg.wait_for_timeout(600)
    s = img(pg)
    check("Reset shape: own shape again, uncropped, Fit and Crop focus hidden", section(pg).get("ratio") == "auto" and abs(s["w"] / s["h"] - s["nat"]) < 0.02 and panel(pg).get_by_text("Fit", exact=True).count() == 0, str(s))
    check("The photo file is untouched (same address as chosen)", section(pg).get("image", "").endswith("brand-proposal-cover-art.webp"))
    check("No soft-photo note for a large photo", panel(pg).locator(".el-warning").count() == 0)

    # 7. Keyboard and accessibility of the controls.
    sel = panel(pg).get_by_label("Shape", exact=True); sel.focus(); pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(500)
    check("Shape can be changed with the keyboard", section(pg).get("ratio") != "auto", section(pg).get("ratio"))
    names = panel(pg).locator("button").evaluate_all("bs => bs.filter(b => !(b.getAttribute('aria-label') || b.textContent.trim())).length")
    check("Every button in the Photo settings has a name", names == 0, str(names))
    if AXE:
        pg.add_script_tag(path=AXE)
        bad = pg.evaluate("async () => (await axe.run({ include: [['.el-panel']] }, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] })).violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id)")
        check("axe: the Photo settings have no serious or critical problems", not bad, str(bad))
    pg.close()

    # 8. A small photo shown wide: the editor says it may look soft.
    pg, e = fresh(br, 1920, 1000); errors += e
    add_photo(pg, "d title"); select_photo(pg)
    panel(pg).get_by_role("button", name="Full", exact=True).click(); pg.wait_for_timeout(900)
    warn = panel(pg).locator(".el-warning")
    check("A 466 px photo at Full on a wide screen gets the soft-photo note", warn.count() == 1 and "466" in warn.inner_text(), warn.inner_text() if warn.count() else "none")
    panel(pg).get_by_role("button", name="Narrow", exact=True).click(); pg.wait_for_timeout(900)
    check("At Narrow (still wider than 466 px on this screen) the note stays", panel(pg).locator(".el-warning").count() == 1, f"{img(pg)['box']:.0f}px")
    panel(pg).get_by_label("Width in per cent").fill("60"); panel(pg).get_by_label("Width in per cent").press("Enter"); pg.wait_for_timeout(900)
    check("Once it is no wider than the original, the note goes", panel(pg).locator(".el-warning").count() == 0 and img(pg)["box"] <= 466, f"{img(pg)['box']:.0f}px")
    pg.close()

    # 9. On a phone: the controls fit and the photo uses the phone's width even at Wide.
    pg, e = fresh(br, 390, 844); errors += e
    add_photo(pg, "brand proposal cover art")
    check("Phone: a page with a photo opens with the photo shown", frame(pg).locator(".free-photo img").count() == 1)
    ph = frame(pg).locator(".free-photo").first; ph.scroll_into_view_if_needed(); b = ph.bounding_box(); pg.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2); pg.wait_for_timeout(700)
    pg.get_by_role("button", name="Settings").first.click(); pg.wait_for_timeout(700)
    g = panel(pg)
    check("Phone editor: the Photo settings open", g.count() == 1)
    if g.count():
        g.get_by_role("button", name="Wide", exact=True).click(); pg.wait_for_timeout(600)
        over = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        check("Phone editor: no sideways scrolling with the Photo settings open", not over)
    pg.close()
    check("No script errors", not errors, str(errors[:3]))
    br.close()
print(f"{sum(res)} of {len(res)} passed")
