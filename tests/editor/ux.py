# UX refinements (prototype round 1). Run from the repository root after `bun run build`
# and `python3 tests/editor/serve.py dist 4302 &`.
exec(open(__file__.replace("ux.py", "notes.py")).read().split("with sync_playwright")[0])

with sync_playwright() as p:
    br = p.chromium.launch()
    # 1. The More menu behaves like other menus.
    pg, f, errs = open_editor(br, "about-face-beauty", 1280, 800)
    more = pg.get_by_role("button", name="More").first
    more.click(); pg.wait_for_timeout(200)
    check("More opens", pg.locator(".editor-more.open").count() == 1)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Escape closes More and returns focus to it", pg.locator(".editor-more.open").count() == 0 and pg.evaluate("document.activeElement.textContent.trim().startsWith('More')"))
    more.click(); pg.wait_for_timeout(200); pg.mouse.click(640, 500); pg.wait_for_timeout(200)
    check("Clicking elsewhere closes More", pg.locator(".editor-more.open").count() == 0)

    # 2. The navigator is called the same thing everywhere.
    # (Round 4: one Sections panel replaced Add section and Page navigator; the same check now asks
    # that it is named the same everywhere and that Puck's own "Outline" and "Blocks" never show.)
    if not pg.locator(".sec-panel:visible").count(): pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(600)
    shown = pg.evaluate("[...document.querySelectorAll('[class*=_NavItem]')].filter(e => getComputedStyle(e).display !== 'none' && e.offsetParent).map(e => e.innerText.trim())")
    heads = pg.evaluate("[...document.querySelectorAll('h2, [class*=SidebarSection-title], [class*=SidebarSection-heading]')].map(e => e.textContent.trim()).filter(Boolean)")
    check("The left panel is called Sections everywhere, never Outline or Blocks", "Sections" in shown and not any(h in ("Outline", "Blocks") for h in heads + shown) and pg.locator(".sec-panel:visible").count() == 1, f"{shown} {heads}")

    # 3. Per-size dot: a Tablet-only change marks Tablet, not Desktop.
    pg.get_by_role("button", name="Tablet").first.click(); pg.wait_for_timeout(1200); f = frame(pg)
    click(pg, f, "[data-el='line']")
    pg.locator(".ctx button[aria-label='Bold']").click(); pg.wait_for_timeout(500)
    dots = pg.evaluate("[...document.querySelectorAll('.editor-screens button')].filter(b => b.querySelector('.editor-own-dot')).map(b => b.textContent.replace(/\\(.*\\)/, '').trim())")
    check("Tablet change puts a dot on Tablet only", dots == ["Tablet"], str(dots))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Escape from the toolbar deselects, and the dot goes", pg.locator(".editor-own-dot").count() == 0)
    click(pg, f, "[data-el='line']")
    pg.locator(".ctx .ctx-more").first.click(); pg.wait_for_timeout(300)
    check("Select more has its own icon, not the Add icon", pg.locator(".ctx-more-menu button", has_text="Select more parts").locator("svg rect").count() == 2)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    pg.close()

    # 4. Phone: arrows show that the tools continue, and reveal them.
    pg, f, errs2 = open_editor(br, "about-face-beauty", 390, 844)
    click(pg, f, "[data-el='line']")
    right = pg.locator(".ctx-scroll-right")
    check("Phone: an arrow shows more tools to the right", right.count() == 1 and right.is_visible())
    before = pg.evaluate("document.querySelector('.editor-bar-ctx .ctx').scrollLeft")
    for _ in range(6):
        if pg.locator(".ctx-scroll-right").count() == 0: break
        pg.locator(".ctx-scroll-right").click(); pg.wait_for_timeout(500)
    after = pg.evaluate("document.querySelector('.editor-bar-ctx .ctx').scrollLeft")
    reset = pg.locator(".ctx .ctx-more").bounding_box()
    check("Phone: the arrow scrolls to More (Hide, Reset)", after > before and reset and reset["x"] + reset["width"] <= 390, f"{before}->{after}")
    check("Phone: a left arrow appears once scrolled", pg.locator(".ctx-scroll-left").count() == 1)
    check("Phone: arrows are not in the keyboard order", pg.evaluate("[...document.querySelectorAll('.ctx-scroll')].every(b => b.tabIndex === -1)"))
    pg.close()

    pg, f, errs3 = open_editor(br, "about-face-beauty", 1440, 900)
    click(pg, f, "[data-el='line']")
    check("Wide screen: no arrows when every tool fits", pg.locator(".ctx-scroll").count() == 0)
    pg.close()
    check("No script errors", not (errs + errs2 + errs3), str((errs + errs2 + errs3)[:2]))
    print(f"{sum(res)} of {len(res)} passed")
