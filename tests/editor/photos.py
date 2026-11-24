# Demo 5.1: photos are added in the website editor (Sveltia), not in this editor. Add a section offers
# only Text, Statement and Space; there is no photo picker and no Choose or Replace photo button; a
# photo already on the page can still be selected and presented. An Image section with no photo (only
# an old draft can hold one) says to remove it, opens nothing when clicked, can be kept in a draft,
# blocks publishing, and publishing is possible again once it is removed. Run from the repository
# root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import os, re
from playwright.sync_api import sync_playwright
from seed import seed, image, PHOTOS
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = "http://localhost:4302/admin/design/?project=about-face-beauty"
AXE = os.environ.get("AXE") or next((p for p in ["node_modules/axe-core/axe.min.js", "/tmp/axe/node_modules/axe-core/axe.min.js"] if os.path.exists(p)), None)
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def fresh(br, w=1440, h=900):
    pg = br.new_page(viewport={"width": w, "height": h}, bypass_csp=True); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    if not pg.locator(".sec-panel:visible").count(): pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(600)
    return pg, errs
PHOTO_WORDS = re.compile(r"choose a photo|replace photo|use this photo", re.I)

with sync_playwright() as p:
    br = p.chromium.launch(); errors = []

    # 1. Add a section: the three kinds that need no photo, and where photos are added instead.
    pg, e = fresh(br); errors += e
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    opts = [t.split("\n")[0].strip() for t in pg.locator(".sec-option").all_inner_texts()]
    check("Add a section offers Text, Statement and Space only", opts == ["Text", "Statement", "Space"], str(opts))
    foot = pg.locator(".sec-panel:visible").inner_text()
    check("It says photos are added in the website editor (/admin)", "website editor (/admin)" in foot)
    check("No Images group or image options", not re.search(r"\bImages?\b|Two images|Image and text", "\n".join(opts)))
    pg.close()

    # 2. A photo already on the page: selectable and presentable; no way to add, choose or replace one.
    pg, e = fresh(br); errors += e
    seed(pg, [image(PHOTOS["brand proposal cover art"])])
    f = frame(pg); ph = f.locator(".free-photo").first
    check("A photo on the page is shown", ph.count() == 1 and f.locator(".free-photo img").evaluate("i => i.complete && i.naturalWidth > 0"))
    ph.scroll_into_view_if_needed(); b = ph.bounding_box(); pg.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2); pg.wait_for_timeout(700)
    pg.get_by_role("button", name=re.compile("^(All )?[Ss]ettings$")).first.click(); pg.wait_for_timeout(600)
    check("Selecting it opens Look: Photo (Present the photo)", pg.locator("section.el-group[aria-label='Look: Photo']:visible").count() == 1)
    buttons = " ".join(pg.locator("button:visible").all_inner_texts() + [x or "" for x in pg.locator("button:visible").evaluate_all("b => b.map(x => x.getAttribute('aria-label'))")])
    check("No Choose, Replace or Use this photo button anywhere", not PHOTO_WORDS.search(buttons), PHOTO_WORDS.findall(buttons)[:3])
    check("No photo picker in the page", pg.locator(".ph-dialog, [class*='ph-']").count() == 0)
    check("Settings do not offer a photo list to pick from", pg.locator(".el-panel select option", has_text=re.compile("cover art", re.I)).count() == 0)
    pg.close()

    # 3. An old draft with an empty Image section: says what to do, opens nothing, blocks publishing.
    pg, e = fresh(br); errors += e
    seed(pg, [image("", "", "Image-empty")])
    f = frame(pg); empty = f.locator(".editor-empty-image")
    check("The empty section says No photo and to remove it", empty.count() == 1 and "Remove this section before publishing" in empty.inner_text(), empty.inner_text() if empty.count() else "none")
    check("It has no button", empty.locator("button").count() == 0)
    empty.scroll_into_view_if_needed(); b = empty.bounding_box(); pg.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2); pg.wait_for_timeout(700)
    check("Clicking it opens no picker or dialog", pg.locator("[role='dialog']:visible, .ph-dialog").count() == 0)
    pg.locator(".editor-save").click(); pg.wait_for_timeout(1000)
    check("A draft with it can still be saved", pg.locator(".editor-status").inner_text().startswith("Draft saved"), pg.locator(".editor-status").inner_text())
    pg.get_by_role("button", name="Publish").first.click(); pg.wait_for_timeout(4500)
    panel = pg.locator(".editor-panel"); txt = panel.inner_text()
    check("Publishing says the Image section has no photo and to remove it in Sections", "An Image section has no photo" in txt and "Remove it in Sections" in txt, txt[:200])
    check("Publish stays unavailable", panel.locator(".editor-primary").is_disabled())
    check("The message has no picker buttons", panel.locator(".editor-blocked button").count() == 0)
    if AXE:
        pg.add_script_tag(path=AXE)
        bad = pg.evaluate("async () => (await axe.run({ include: [['.editor-panel']] }, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] })).violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id)")
        check("axe: the publish panel has no serious or critical problems", not bad, str(bad))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    row = pg.locator(".sec-row", has=pg.locator(".sec-name", has_text=re.compile("^Image")))
    row.locator(".sec-more").click(); pg.wait_for_timeout(200); pg.locator(".sec-menu button", has_text="Remove").first.click(); pg.wait_for_timeout(800)
    check("Removing it in Sections takes it off the page", frame(pg).locator(".editor-empty-image").count() == 0)
    pg.get_by_role("button", name="Publish").first.click(); pg.wait_for_timeout(4500)
    check("Publishing is possible again", not pg.locator(".editor-panel .editor-blocked").count() and pg.locator(".editor-panel .editor-primary").is_enabled())
    pg.close()

    # 4. Phone: the same three kinds, nothing runs off the side.
    pg, e = fresh(br, 390, 844); errors += e
    if not pg.locator(".sec-panel:visible").count(): pg.get_by_role("button", name=re.compile("^Sections")).first.click(); pg.wait_for_timeout(600)
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    opts = [t.split("\n")[0].strip() for t in pg.locator(".sec-option:visible").all_inner_texts()]
    check("Phone: Add a section offers Text, Statement and Space", opts == ["Text", "Statement", "Space"], str(opts))
    check("Phone: no sideways scrolling", not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"))
    pg.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
