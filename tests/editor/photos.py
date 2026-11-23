# Step A: choosing photos for Image sections. The empty frame (shape, width, one clear action), the
# picker (grouped by project, this project first, every thumbnail loads, keyboard use, focus kept
# inside, Escape), the description being required, the photo appearing at once at its own shape,
# Replace photo, Undo and Redo, publishing refused while any Image section is empty (also inside
# columns), drafts still allowed, and the picker on a phone. Run from the repository root after
# `bun run build` and `python3 tests/editor/serve.py dist 4302 &`. a11y checks need axe (see README).
import json, os
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = "http://localhost:4302/admin/design/?project=about-face-beauty"
AXE = os.environ.get("AXE") or next((p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p)), None)
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def unsaved(pg): return pg.evaluate("JSON.parse(localStorage.getItem('design-editor:about-face-beauty:unsaved')||'null')")
def images(pg):
    out = []
    def walk(items):
        for i in items:
            if i["type"] == "Image": out.append(i["props"])
            for v in i["props"].values():
                if isinstance(v, list) and all(isinstance(x, dict) and "type" in x for x in v): walk(v)
    walk((unsaved(pg) or {}).get("content", []))
    return out
def fresh(br, w=1440, h=900):
    pg = br.new_page(viewport={"width": w, "height": h}, bypass_csp=True); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    if not pg.locator(".sec-panel:visible").count(): pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(600)
    return pg, errs
def add(pg, what):
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    pg.locator(".sec-option", has_text=what).first.click(); pg.wait_for_timeout(1200)
def click_frame(pg, n=0):
    e = frame(pg).locator(".editor-empty-image").nth(n); e.scroll_into_view_if_needed(); pg.wait_for_timeout(300); b = e.bounding_box()
    pg.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] * 0.2); pg.wait_for_timeout(700)
dialog = ".ph-dialog"

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []

    # 1. The empty frame: 3:2, no wider than the text column, one clear button, never a thin strip.
    pg, e = fresh(br); errors += e
    add(pg, "One image")
    f = frame(pg); box = f.locator(".editor-empty-image").first.bounding_box()
    root = f.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)")
    check("An empty Image section is a 3:2 frame, not a strip", box and abs(box["width"] / box["height"] - 1.5) < 0.02 and box["height"] > 150, str(box))
    check("It is no wider than the text column (42rem)", box["width"] <= 42 * root + 1, f"{box['width']:.0f} vs {42 * root:.0f}")
    check("It says No photo yet and has a Choose a photo button", f.locator(".editor-empty-image").first.inner_text().strip().startswith("No photo yet") and f.get_by_role("button", name="Choose a photo").count() == 1)
    check("The section bar offers Choose a photo too", pg.locator(".ctx-photo").inner_text() == "Choose a photo")

    # 2. Clicking anywhere on the frame opens the picker: grouped, this project first, every picture loads.
    click_frame(pg)
    check("Clicking the frame opens Choose a photo", pg.locator(dialog).count() == 1 and pg.locator("#ph-title").inner_text() == "Choose a photo")
    heads = pg.locator(".ph-groups h3").all_inner_texts()
    check("Photos are grouped by project, this project first, About page last", heads[0].lower().startswith("af-binary") and "(this project)" in heads[0].lower() and heads[-1].lower() == "about page", str(heads))
    pg.evaluate("async () => { const g = document.querySelector('.ph-groups'); for (let y = 0; y < g.scrollHeight; y += 200) { g.scrollTop = y; await new Promise(r => setTimeout(r, 40)) } }"); pg.wait_for_timeout(800)
    broken = pg.evaluate("[...document.querySelectorAll('.ph-pick img')].filter(i => !i.complete || !i.naturalWidth).length")
    total = pg.locator(".ph-pick").count()
    check("Every photo in the website is offered, and every thumbnail loads", total >= 15 and broken == 0, f"{total} photos, {broken} broken")
    check("Each photo has a readable name for screen readers", all(l and "," in l for l in pg.locator(".ph-pick").evaluate_all("els => els.map(e => e.getAttribute('aria-label'))")))
    check("Focus starts on the first photo", "ph-pick" in pg.evaluate("document.activeElement.className"))

    # 3. A photo and a description are both needed; the photo then appears at once, at its own shape.
    pg.get_by_role("button", name="Use this photo").click(); pg.wait_for_timeout(200)
    check("Use without choosing says Choose a photo first", pg.locator(".ph-missing").inner_text() == "Choose a photo first.")
    pg.locator(".ph-pick").first.click(); pg.wait_for_timeout(150)
    check("The chosen photo is marked", pg.locator(".ph-pick").first.get_attribute("aria-pressed") == "true" and pg.locator(".ph-tick").count() == 1)
    pg.get_by_role("button", name="Use this photo").click(); pg.wait_for_timeout(200)
    check("Use without a description asks for one, and marks the field", pg.locator(".ph-missing").inner_text().startswith("Describe the photo") and pg.locator(".ph-alt input").get_attribute("aria-invalid") == "true")
    pg.locator(".ph-alt input").fill("AF-Binary filter on a face"); pg.keyboard.press("Enter"); pg.wait_for_timeout(1000)
    check("Enter in the description uses the photo and closes the picker", pg.locator(dialog).count() == 0)
    im = images(pg)[0]
    check("The section now has the photo, its description and its own shape", im.get("image", "").startswith("/media/") and im.get("alt") == "AF-Binary filter on a face" and im.get("ratio") == "auto", json.dumps(im)[:160])
    f = frame(pg); shown = f.evaluate(f"""() => {{ const i = [...document.querySelectorAll('.free-image img')].find(x => x.getAttribute('src')?.includes('{im['image'].split('/')[-1]}')); if (!i) return null; return {{ r: i.offsetWidth / i.offsetHeight, nat: i.naturalWidth / i.naturalHeight, alt: i.alt }} }}""")
    check("It appears on the page straight away, uncropped and undistorted", shown and abs(shown["r"] - shown["nat"]) < 0.02 and shown["alt"] == "AF-Binary filter on a face", str(shown))
    check("The empty frame is gone", f.locator(".editor-empty-image").count() == 0)
    label = pg.locator(".editor-history button").first.get_attribute("aria-label") or ""
    check("Undo names the step", "choose a photo for image" in label.lower(), label)
    pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(700)
    check("Undo brings the empty frame back", frame(pg).locator(".editor-empty-image").count() == 1 and not images(pg)[0].get("image"))
    pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(700)
    check("Redo puts the photo back", images(pg)[0].get("image", "").startswith("/media/"))

    # 4. Replace photo: the picker opens on the current photo and description; Escape changes nothing.
    pg.locator(".sec-row", has=pg.locator(".sec-name", has_text="Image")).locator(".sec-go").click(); pg.wait_for_timeout(600)
    check("With a photo, the section bar says Replace photo", pg.locator(".ctx-photo").inner_text() == "Replace photo")
    pg.locator(".ctx-photo").click(); pg.wait_for_timeout(600)
    check("The picker shows the current photo chosen and its description filled in", pg.locator(".ph-pick[aria-pressed='true']").count() == 1 and pg.locator(".ph-alt input").input_value() == "AF-Binary filter on a face")
    check("Focus starts on the current photo", pg.evaluate("document.activeElement.getAttribute('aria-pressed')") == "true")
    # Focus stays inside: Tab from the last control goes back to the first.
    pg.get_by_role("button", name="Use this photo").focus(); pg.keyboard.press("Tab")
    check("Tab from the last control wraps to the first (focus stays in the picker)", pg.evaluate("!!document.activeElement.closest('.ph-dialog')"))
    pg.locator(".ph-pick").nth(2).focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(150)
    check("Enter on a photo chooses it", pg.locator(".ph-pick").nth(2).get_attribute("aria-pressed") == "true")
    before = images(pg)[0]["image"]
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Escape closes without changing anything, focus back on Replace photo", pg.locator(dialog).count() == 0 and images(pg)[0]["image"] == before and "Replace photo" in pg.evaluate("document.activeElement.innerText"))
    if AXE:
        pg.locator(".ctx-photo").click(); pg.wait_for_timeout(500)
        pg.add_script_tag(path=AXE)
        bad = pg.evaluate("async () => (await axe.run({ include: [['.ph-dialog']] }, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] })).violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id)")
        check("axe: the picker has no serious or critical problems", not bad, str(bad))
        pg.keyboard.press("Escape")
    pg.close()

    # 5. Publishing is refused while any Image section has no photo (also inside columns); drafts are fine.
    pg, e = fresh(br); errors += e
    add(pg, "Two images")
    check("Two images shows two empty frames", frame(pg).locator(".editor-empty-image").count() == 2)
    pg.locator(".editor-save").click(); pg.wait_for_timeout(1000)
    check("A draft with empty Image sections can still be saved", pg.locator(".editor-status").inner_text().startswith("Draft saved"))
    pg.get_by_role("button", name="Publish").first.click(); pg.wait_for_timeout(4500)
    panel = pg.locator(".editor-panel")
    check("The publish panel says two Image sections have no photo", "2 Image sections have no photo yet" in panel.inner_text())
    check("Publish is not possible until they have photos", panel.locator(".editor-primary").is_disabled())
    panel.locator(".editor-blocked button").first.click(); pg.wait_for_timeout(600)
    check("Choose a photo in the panel opens the picker", pg.locator(dialog).count() == 1)
    pg.locator(".ph-pick").nth(1).click(); pg.locator(".ph-alt input").fill("First photo"); pg.get_by_role("button", name="Use this photo").click(); pg.wait_for_timeout(800)
    click_frame(pg, 0)
    pg.locator(".ph-pick").nth(3).click(); pg.locator(".ph-alt input").fill("Second photo"); pg.get_by_role("button", name="Use this photo").click(); pg.wait_for_timeout(800)
    pg.get_by_role("button", name="Publish").first.click(); pg.wait_for_timeout(4500)
    check("With both photos chosen, publishing is allowed again", not pg.locator(".editor-panel .editor-blocked").count() and pg.locator(".editor-panel .editor-primary").is_enabled())
    pg.close()

    # 6. On a phone: the picker fills the screen, three photos a row, nothing runs off the side.
    pg, e = fresh(br, 390, 844); errors += e
    add(pg, "One image")
    if pg.locator(".sec-panel:visible").count(): pg.keyboard.press("Escape")
    pg.locator(".ctx-photo").click(); pg.wait_for_timeout(600)
    d = pg.locator(dialog).bounding_box()
    cols = pg.evaluate("getComputedStyle(document.querySelector('.ph-grid')).gridTemplateColumns.split(' ').length")
    over = pg.evaluate("document.documentElement.scrollWidth > innerWidth")
    tap = pg.locator(".ph-pick").first.bounding_box()
    check("Phone: the picker fills the screen with three photos a row; targets are large", d["width"] >= 389 and cols == 3 and not over and tap["width"] >= 44, f"{d['width']} {cols} {tap['width']}")
    vis = [(lambda b: bool(b) and b["y"] >= 0 and b["y"] + b["height"] <= 844)(pg.locator(dialog).get_by_role("button", name=n, exact=True).bounding_box()) for n in ("Use this photo", "Cancel")]
    check("Phone: Use this photo and Cancel are on screen, inside the phone's height", all(vis), str(vis))
    fb = pg.locator(".ph-alt input").bounding_box()
    check("Phone: the description box is on screen too", fb and fb["y"] + fb["height"] <= 844, str(fb))
    pg.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
