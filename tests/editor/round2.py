# UX round 2: image rotation, positioning and spacing suggestions, the "Also here" list, typed numbers,
# save status and undo labels. Run from the repository root after `bun run build` and
# `python3 tests/editor/serve.py dist 4302 &`.
import re, math
exec(open(__file__.replace("round2.py", "notes.py")).read().split("with sync_playwright")[0])

def frame_click(pg, f):
    fb = f.locator(".el-frame").bounding_box(); pg.mouse.click(fb["x"] + fb["width"] / 2, fb["y"] + fb["height"] / 2)
def keys(pg, key, n):
    for _ in range(n): pg.keyboard.press(key)
def notes(pg):
    if not pg.locator(chip).count(): return "", []
    label = pg.locator(chip).inner_text(); pg.locator(chip).click(); pg.wait_for_timeout(200)
    items = pg.locator(".editor-notes-list li").all_inner_texts(); return label, items
def close_notes(pg): pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
def tilt(f): return f.evaluate("getComputedStyle(document.querySelector('.cs-open-visual > .tilt')).getPropertyValue('--tilt').trim()")
def own(pg, slug, key, screen):
    for it in saved(pg, slug).get("content") or []:
        st = (it["props"].get("elements") or {}).get(key)
        if st is not None: return st.get(screen, {})
    return {}
def turn(pg, f, degrees, shift=False):
    h = f.locator(".el-rotate").bounding_box(); box = f.locator(".cs-open-visual").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    sx, sy = h["x"] + h["width"] / 2, h["y"] + h["height"] / 2
    r = math.hypot(sx - cx, sy - cy); a0 = math.atan2(sy - cy, sx - cx)
    pg.mouse.move(sx, sy); pg.mouse.down()
    if shift: pg.keyboard.down("Shift")
    for k in range(1, 11):
        a = a0 + math.radians(degrees * k / 10); pg.mouse.move(cx + r * math.cos(a), cy + r * math.sin(a)); pg.wait_for_timeout(15)
    label = f.locator(".el-frame .el-tag").inner_text()
    if shift: pg.keyboard.up("Shift")
    pg.mouse.up(); pg.wait_for_timeout(500)
    return label
angle_field = ".ctx input[aria-label='Angle in degrees']"

def more(pg, item):
    pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(300)
    pg.locator(".ctx-more-menu button", has_text=item).first.click(); pg.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    errors = []

    # 1. Rotation with the mouse, typed, per screen size, undo, redo and reset.
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, ".cs-open-visual")
    check("Selected cover shows its designed angle", pg.locator(angle_field).input_value() == "-1.25", pg.locator(angle_field).input_value())
    check("A round rotate handle sits above the image", f.locator(".el-frame .el-rotate").count() == 1)
    live = turn(pg, f, 9)
    check("Dragging the handle shows the angle while turning", live.startswith("Angle"), live)
    a = own(pg, "about-face-beauty", "image", "desktop").get("rotate")
    check("Letting go saves the angle for Desktop", a is not None and 6 <= a <= 9, str(a))
    check("The page shows the new angle", tilt(f) == f"{a:g}deg", tilt(f))
    src_before = f.evaluate("document.querySelector('.cs-open-visual img').currentSrc")
    check("The image file is unchanged (same source, browser draws it turned)", src_before.endswith((".webp", ".jpg", ".png", ".avif")) and "rotate" not in src_before, src_before[-40:])
    live = turn(pg, f, 40, shift=True)
    a2 = own(pg, "about-face-beauty", "image", "desktop").get("rotate")
    check("Shift keeps the angle to steps of 15°", a2 is not None and a2 % 15 == 0, f"{live} -> {a2}")
    inp = pg.locator(angle_field); inp.click(); inp.fill("-6"); inp.press("Enter"); pg.wait_for_timeout(400)
    check("Typing an angle and pressing Enter applies it", own(pg, "about-face-beauty", "image", "desktop").get("rotate") == -6 and tilt(f) == "-6deg", tilt(f))
    inp.click(); inp.fill("30"); inp.press("Escape"); pg.wait_for_timeout(300)
    check("Escape in the field puts the typed number back", pg.locator(angle_field).input_value() == "-6" and tilt(f) == "-6deg")
    inp.click(); inp.press("ArrowUp"); pg.wait_for_timeout(700)
    check("Arrow keys step the angle by 0.5°", own(pg, "about-face-beauty", "image", "desktop").get("rotate") == -5.5)
    undo = pg.locator(".editor-history button").first
    check("Undo names what it will undo", undo.get_attribute("aria-label") == "Undo: turn Opening image", undo.get_attribute("aria-label"))
    undo.click(); pg.wait_for_timeout(400)
    check("Undo goes back one step", own(pg, "about-face-beauty", "image", "desktop").get("rotate") == -6)
    check("A short message says what was undone", "Undone: turn Opening image" in (pg.locator(".editor-undone").inner_text() if pg.locator(".editor-undone").count() else ""))
    pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(400)
    check("Redo puts it back", own(pg, "about-face-beauty", "image", "desktop").get("rotate") == -5.5)
    # Tablet gets its own angle; Desktop keeps its own.
    pg.get_by_role("button", name="Tablet").first.click(); pg.wait_for_timeout(1400); f = frame(pg)
    click(pg, f, ".cs-open-visual")
    check("Tablet follows Desktop until set there", pg.locator(angle_field).input_value() == "-5.5")
    inp = pg.locator(angle_field); inp.click(); inp.fill("3"); inp.press("Enter"); pg.wait_for_timeout(400)
    check("Tablet angle is saved for Tablet only", own(pg, "about-face-beauty", "image", "tablet").get("rotate") == 3 and own(pg, "about-face-beauty", "image", "desktop").get("rotate") == -5.5)
    dots = pg.evaluate("[...document.querySelectorAll('.editor-screens button')].filter(b => b.querySelector('.editor-own-dot')).map(b => b.firstChild.textContent.trim())")
    check("Dots show Desktop and Tablet have their own settings", dots == ["Desktop", "Tablet"], str(dots))
    more(pg,"Reset Tablet changes"); pg.wait_for_timeout(100)
    check("Reset at Tablet returns to Desktop's angle", "rotate" not in own(pg, "about-face-beauty", "image", "tablet") and tilt(f) == "-5.5deg", tilt(f))
    # Phone: no new clipping at a moderate angle; a steep angle is reported if it is cut off.
    pg.get_by_role("button", name="Phone").first.click(); pg.wait_for_timeout(1400); f = frame(pg)
    click(pg, f, ".cs-open-visual")
    inp = pg.locator(angle_field); inp.click(); inp.fill("25"); inp.press("Enter"); pg.wait_for_timeout(2600)
    label, items = notes(pg); close_notes(pg)
    check("Phone: a steep angle that is cut off is reported", any("Opening image" in i and ("cut off" in i or "edge of the screen" in i or "sticks out" in i) for i in items), " | ".join(items)[:200])
    pg.close()

    # 2. Suggestions: small nudges say nothing; near misses, long moves and odd spacing are suggested.
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, "[data-el='line']"); frame_click(pg, f); keys(pg, "ArrowRight", 2); pg.wait_for_timeout(2200)
    label, items = notes(pg)
    check("A 9px miss of the text edge is suggested, with Line it up", label == "1 suggestion" and "off the left edge" in " ".join(items) and "Line it up" in " ".join(items), f"{label}: {items}")
    pg.locator(".editor-notes-list button", has_text="Line it up").click(); pg.wait_for_timeout(2200)
    check("Line it up puts it on the edge, and the suggestion goes", pg.locator(chip).count() == 0 and abs(float(f.evaluate("parseFloat(getComputedStyle(document.querySelector(\"[data-el='line']\")).left) || 0"))) < 1)
    check("Line it up is one step to undo", pg.locator(".editor-history button").first.get_attribute("aria-label") == "Undo: move Summary line")
    pg.close()
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, "[data-el='image']"); frame_click(pg, f); keys(pg, "ArrowLeft", 3); pg.wait_for_timeout(2200)
    check("A small nudge of an image says nothing", pg.locator(chip).count() == 0)
    pg.close()
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, "[data-el='line']"); frame_click(pg, f); keys(pg, "Shift+ArrowDown", 3); pg.wait_for_timeout(2200)
    label, items = notes(pg)
    check("Moving text 54px down suggests matching the section's spacing", "space above" in " ".join(items) and "Match the spacing" in " ".join(items), " | ".join(items))
    pg.locator(".editor-notes-list button", has_text="This is intended").first.click(); pg.wait_for_timeout(600)
    check("This is intended quiets it, for this part and size", pg.locator(chip).count() == 0 or "suggestion" not in pg.locator(chip).inner_text())
    ids = [i["id"] for i in (saved(pg, "about-face-beauty").get("root", {}).get("props", {}).get("intended") or [])]
    check("The choice is saved with the page, named by part, size and kind", ids == ["Opening-standard|line|desktop|spacing"] or (len(ids) == 1 and ids[0].endswith("|line|desktop|spacing")), str(ids))
    pg.close()
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, "[data-el='line']"); frame_click(pg, f); keys(pg, "Shift+ArrowRight", 20); pg.wait_for_timeout(2200)
    label, items = notes(pg)
    check("A long move is suggested, with Move it back", "from where it was designed to sit" in " ".join(items) and "Move it back" in " ".join(items), " | ".join(items))
    check("Problems and suggestions are listed separately", pg.locator(".editor-notes-head").all_inner_texts() == ["Problems", "Suggestions"], str(pg.locator(".editor-notes-head").all_inner_texts()))
    pg.locator(".editor-notes-list button", has_text="Move it back").click(); pg.wait_for_timeout(2200)
    check("Move it back returns it to its designed place", pg.locator(chip).count() == 0 and f.evaluate("getComputedStyle(document.querySelector(\"[data-el='line']\")).left") in ("0px", "auto"))
    pg.close()

    # 3. "Also here": choose a part behind another.
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    click(pg, f, "[data-el='line']"); frame_click(pg, f); keys(pg, "Shift+ArrowRight", 40); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    line = f.locator("[data-el='line']").bounding_box(); img = f.locator("[data-el='image']").bounding_box()
    pg.mouse.click(max(line["x"], img["x"]) + 20, max(line["y"], img["y"]) + 10); pg.wait_for_timeout(500)
    check("Clicking where parts overlap offers the others", pg.locator(".ctx-also").count() == 1 and "Also here (1)" in pg.locator(".ctx-also").inner_text())
    pg.locator(".ctx-also").click(); pg.wait_for_timeout(200)
    check("The list names the part behind", pg.locator(".ctx-menu button").all_inner_texts() == ["Opening image"])
    pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    check("Keyboard: Enter on the list selects it", pg.locator(".ctx-name").inner_text() == "Opening image")
    check("The list stays, to switch back", pg.locator(".ctx-also").count() == 1)
    pg.close()

    # 4. Typed numbers in More settings: width and position.
    pg, f, errs = open_editor(br, "cancel-me-not", 1440, 900); errors += errs
    click(pg, f, "[data-el='figure-0']")
    pg.get_by_role("button", name=re.compile("^(All )?[Ss]ettings$")).click(); pg.wait_for_timeout(500)
    pg.locator("details.el-fine:visible summary").first.click(); pg.wait_for_timeout(300)  # exact position is in Fine-tune (Demo 5)
    across = pg.locator("input[aria-label='Across']:visible")
    across.click(); across.fill("32"); across.press("Enter"); pg.wait_for_timeout(400)
    check("Typing 32 in Across moves it 32px (2rem)", own(pg, "cancel-me-not", "figure-0", "desktop").get("x") == 2)
    pg.locator("button[aria-label='Across: more']:visible").click(); pg.wait_for_timeout(300)
    pg.wait_for_timeout(400)
    check("The + button still steps it", own(pg, "cancel-me-not", "figure-0", "desktop").get("x") == 2.25, str(own(pg, "cancel-me-not", "figure-0", "desktop")))
    pg.close()

    # 5. Save status: up to date, not saved yet, saved, and a failed save.
    pg, f, errs = open_editor(br, "about-face-beauty", 1440, 900); errors += errs
    status = lambda: pg.locator(".editor-status").inner_text()
    check("Opens as Same as the website", status() == "Same as the website")
    click(pg, f, "[data-el='line']"); pg.locator(".ctx button[aria-label='Bold']").click(); pg.wait_for_timeout(500)
    check("A change shows Not saved yet", status() == "Not saved yet")
    pg.locator(".editor-save").click(); pg.wait_for_timeout(600)
    check("Save draft shows Draft saved", status().startswith("Draft saved "), status())
    pg.locator(".ctx button[aria-label='Bold']").click(); pg.wait_for_timeout(300)
    pg.evaluate("() => { Storage.prototype._set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k.endsWith(':draft')) throw new Error('Storage is full.'); return this._set(k, v) } }")
    pg.locator(".editor-save").click(); pg.wait_for_timeout(600)
    check("A failed save says so, in the status", status() == "Not saved: see the message" and pg.locator(".editor-status.is-failed").count() == 1, status())
    pg.evaluate("() => { Storage.prototype.setItem = Storage.prototype._set }")
    pg.locator(".editor-save").click(); pg.wait_for_timeout(600)
    check("Saving again clears it", status().startswith("Draft saved "), status())
    pg.close()

    # 6. Touch: turning the image with a finger on a phone-sized screen.
    ctx = br.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "about-face-beauty", wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500); f = frame(pg)
    v = f.locator(".cs-open-visual").first; v.scroll_into_view_if_needed(); b = v.bounding_box(); pg.touchscreen.tap(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2); pg.wait_for_timeout(500)
    h = f.locator(".el-rotate").bounding_box()
    cdp = ctx.new_cdp_session(pg)
    sx, sy = h["x"] + h["width"] / 2, h["y"] + h["height"] / 2
    cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    r = math.hypot(sx - cx, sy - cy); a0 = math.atan2(sy - cy, sx - cx)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": sx, "y": sy}]})
    for k in range(1, 11):
        a = a0 + math.radians(8 * k / 10)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": cx + r * math.cos(a), "y": cy + r * math.sin(a)}]}); pg.wait_for_timeout(20)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); pg.wait_for_timeout(600)
    a = own(pg, "about-face-beauty", "image", "phone").get("rotate")
    check("Touch: dragging the handle with a finger turns the image (Phone)", a is not None and 4 <= a <= 8, str(a))
    errors += errs
    ctx.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
