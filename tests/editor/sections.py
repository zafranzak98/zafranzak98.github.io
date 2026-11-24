# Round 4: the Sections panel ("On this page" and "Add a section"). Finding, selecting, reordering
# (drag, menu and keyboard), duplicating, showing per screen, removing, adding each kind, where new
# sections go, Undo for every step, and the panel at narrow widths. Run from the repository root after
# `bun run build` and `python3 tests/editor/serve.py dist 4302 &`.
import json
from playwright.sync_api import sync_playwright
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""))
BASE = "http://localhost:4302/admin/design/?project="
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def open_editor(br, slug="about-face-beauty", w=1440, h=900):
    pg = br.new_page(viewport={"width": w, "height": h}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + slug, wait_until="networkidle"); pg.evaluate("localStorage.clear()"); pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    return pg, errs
def open_panel(pg):
    if not pg.locator(".sec-panel:visible").count(): pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(600)
def rows(pg): return [t.split("\n")[0] for t in pg.locator(".sec-row .sec-name").all_inner_texts()]
def page_order(pg):
    return frame(pg).evaluate("[...document.querySelectorAll('[data-puck-component]')].filter(e => !e.parentElement.closest('[data-puck-component]')).map(e => e.getAttribute('data-puck-component').split('-')[0])")
def saved(pg, slug="about-face-beauty"):
    raw = pg.evaluate(f"localStorage.getItem('design-editor:{slug}:unsaved')")
    return json.loads(raw) if raw else None
def ctx(pg): return pg.locator(".editor-bar-ctx").inner_text()
def undo(pg): pg.locator(".editor-history button").first.click(); pg.wait_for_timeout(600)
def redo(pg): pg.locator(".editor-history button").nth(1).click(); pg.wait_for_timeout(600)
def row(pg, name): return pg.locator(".sec-row", has=pg.locator(".sec-name", has_text=name)).first
def menu(pg, name, action):
    row(pg, name).locator(".sec-more").click(); pg.wait_for_timeout(200)
    pg.locator(".sec-menu button", has_text=action).first.click(); pg.wait_for_timeout(600)

with sync_playwright() as p:
    br = p.chromium.launch()
    errors = []

    # 1. One Sections button in the rail; Puck's Blocks and Outline panels are gone.
    pg, e = open_editor(br); errors += e
    rail = pg.locator("[class*='_Nav-list'] > [class*='_NavItem']").evaluate_all("els => els.filter(e => getComputedStyle(e).display !== 'none').map(e => e.innerText.trim())")
    check("The rail shows one Sections button", rail == ["Sections"], str(rail))
    open_panel(pg)
    tabs = pg.get_by_role("tab").all_inner_texts()
    check("Two tabs: On this page and Add a section", tabs == ["On this page", "Add a section"], str(tabs))
    check("On this page is open first", pg.get_by_role("tab", name="On this page").get_attribute("aria-selected") == "true")

    # 2. The list matches the page, top to bottom, with plain names and a line about each.
    names = rows(pg)
    check("Eleven sections listed, in page order", len(names) == 11 and names[1] == "Opening" and names[-1] == "Previous and next", str(names))
    check("Plain names, no internal terms", "Section bar" not in names and "Gap" not in names and "Section links" in names and "Space before sections" in names, str(names))
    check("Each row has a short description", all(h.strip() for h in pg.locator(".sec-row .sec-hint").all_inner_texts()))
    check("Rows are numbered 1 to 11", pg.locator(".sec-num").all_inner_texts() == [str(i) for i in range(1, 12)])

    # 3. Choosing a row selects that section and brings it into view; the row shows it is selected.
    top0 = frame(pg).evaluate("scrollY")
    row(pg, "Outcomes").locator(".sec-go").click(); pg.wait_for_timeout(900)
    check("Choosing Outcomes selects it (section tools show its name)", ctx(pg).startswith("Outcomes"), ctx(pg)[:40])
    check("The page scrolls to Outcomes", frame(pg).evaluate("scrollY") > top0 + 300, str(frame(pg).evaluate("scrollY")))
    check("The Outcomes row is marked as selected", "is-selected" in row(pg, "Outcomes").get_attribute("class") and row(pg, "Outcomes").locator(".sec-go").get_attribute("aria-current") == "true")
    check("Navigating does not change the page", saved(pg) is None)
    # Clicking a part inside a section marks that section's row.
    f = frame(pg); el = f.locator("[data-puck-component^='Overview'] [data-el]").first; el.scroll_into_view_if_needed(); b = el.bounding_box()
    pg.mouse.click(b["x"] + 6, b["y"] + b["height"] / 2); pg.wait_for_timeout(500)
    check("Selecting a part on the page marks its section in the list", "is-selected" in row(pg, "Overview").get_attribute("class"))

    # 4. Reordering with the menu, with Undo and Redo naming the step.
    menu(pg, "Research & thinking", "Move down")
    check("Move down swaps Research and The work in the list", rows(pg)[6:8] == ["The work", "Research & thinking"], str(rows(pg)[5:9]))
    check("…and on the page", page_order(pg)[6:8] == ["Work", "Research"], str(page_order(pg)))
    label = pg.locator(".editor-history button").first.get_attribute("aria-label") or pg.locator(".editor-history button").first.get_attribute("title") or ""
    check("Undo names the swap", "swap" in label.lower() and "Research" in label, label)
    undo(pg)
    check("Undo puts the order back", rows(pg)[6:8] == ["Research & thinking", "The work"], str(rows(pg)[6:8]))
    redo(pg)
    check("Redo swaps them again", rows(pg)[6:8] == ["The work", "Research & thinking"])
    undo(pg)
    row(pg, "Category links").locator(".sec-more").click(); pg.wait_for_timeout(200)
    check("Move up is disabled for the first section", pg.locator(".sec-menu button", has_text="Move up").is_disabled())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Escape closes the menu and returns focus to ⋯", pg.locator(".sec-menu").count() == 0 and pg.evaluate("document.activeElement.className") == "sec-more")

    # 5. Reordering with the keyboard: Alt and an arrow key on a row; focus stays with the section.
    g = row(pg, "Overview").locator(".sec-go"); g.focus(); pg.keyboard.press("Alt+ArrowDown"); pg.wait_for_timeout(500)
    check("Alt+Down moves Overview below Research", rows(pg)[5:7] == ["Research & thinking", "Overview"], str(rows(pg)[5:7]))
    check("Focus follows the moved section", "Overview" in pg.evaluate("document.activeElement.innerText"))
    check("The move is announced", "Overview moved to position 7" in pg.locator(".sec-panel [role=status]").inner_text())
    pg.keyboard.press("Alt+ArrowUp"); pg.wait_for_timeout(500)
    check("Alt+Up moves it back", rows(pg)[5:7] == ["Overview", "Research & thinking"])

    # 6. Reordering by dragging the grip.
    src = row(pg, "Outcomes").locator(".sec-grip"); dst = row(pg, "Overview")
    src.drag_to(dst); pg.wait_for_timeout(700)
    check("Dragging Outcomes onto Overview moves it there", rows(pg).index("Outcomes") == 5, str(rows(pg)))
    check("…and on the page", page_order(pg)[5] == "Outcomes", str(page_order(pg)))
    undo(pg)
    check("Undo after dragging restores the order", rows(pg).index("Outcomes") == 8, str(rows(pg)))

    # 7. Duplicate, show on one screen size, remove.
    menu(pg, "Facts", "Duplicate")
    check("Duplicate adds a second Facts below it", rows(pg)[2:4] == ["Facts", "Facts"], str(rows(pg)[1:5]))
    undo(pg)
    check("Undo removes the duplicate", rows(pg).count("Facts") == 1)
    menu(pg, "The work", "Desktop only")
    check("Show on Desktop only is marked on the row", "Desktop only" in row(pg, "The work").locator(".sec-hint").inner_text())
    st = [i for i in saved(pg)["content"] if i["type"] == "Work"][0]["props"].get("design", {})
    check("…and saved on the section", st.get("show") == "desktop", str(st))
    label = pg.locator(".editor-history button").first.get_attribute("aria-label") or pg.locator(".editor-history button").first.get_attribute("title") or ""
    check("Undo says show or hide The work", "show or hide the work" in label.lower(), label)
    menu(pg, "The work", "All screens")
    check("All screens clears the mark", "Desktop only" not in row(pg, "The work").locator(".sec-hint").inner_text())
    menu(pg, "Outcomes", "Remove")
    check("Remove takes Outcomes off the list and the page", "Outcomes" not in rows(pg) and "Outcomes" not in page_order(pg))
    check("Removing is announced with how to get it back", "Undo brings it back" in pg.locator(".sec-panel [role=status]").inner_text())

    # 8. Add a section: plain groups, a picture for each, where it goes, and Put back.
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    groups = pg.locator(".sec-group h3").all_inner_texts()
    check("Options grouped as Words and Spacing (photos are added in the website editor)", [g.lower() for g in groups[:2]] == ["words", "spacing"], str(groups))
    opts = pg.locator(".sec-option .sec-name").all_inner_texts()
    check("Three kinds to add, in plain words", opts[:3] == ["Text", "Statement", "Space"], str(opts))
    check("Every option has a picture and a description", pg.locator(".sec-option .sec-pic").count() >= 3 and all(t.strip() for t in pg.locator(".sec-option .sec-hint").all_inner_texts()))
    check("A removed project section can be put back", "Outcomes" in opts, str(opts))
    pg.locator(".sec-option", has_text="Outcomes").click(); pg.wait_for_timeout(900)
    check("Putting Outcomes back adds it", "Outcomes" in rows(pg))
    undo(pg); undo(pg)
    check("Two Undos bring the page back to its first order", rows(pg) == names, str(rows(pg)))

    # Where a new section goes: below the selected section, otherwise above "Also in this category".
    row(pg, "Overview").locator(".sec-go").click(); pg.wait_for_timeout(500)
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    check("With Overview selected, new sections go below it", "Overview" in pg.locator(".sec-where select option:checked").inner_text())
    pg.locator(".sec-option", has_text="A heading and a paragraph").click(); pg.wait_for_timeout(1000)
    check("Text is added straight below Overview", rows(pg)[6] == "Text: Heading", str(rows(pg)[4:8]))
    check("The panel goes back to the list, with the new section selected", pg.get_by_role("tab", name="On this page").get_attribute("aria-selected") == "true" and "is-selected" in pg.locator(".sec-row").nth(6).get_attribute("class"))
    check("The new section is selected on the page", ctx(pg).startswith("Text"), ctx(pg)[:30])
    check("Adding is announced", "Text added below Overview" in pg.locator(".sec-panel [role=status]").inner_text())
    label = pg.locator(".editor-history button").first.get_attribute("aria-label") or pg.locator(".editor-history button").first.get_attribute("title") or ""
    check("Undo says add Text", "add text" in label.lower(), label)
    undo(pg)
    pg.keyboard.press("Escape"); pg.locator(".editor-bar-ctx").click(position={"x": 5, "y": 5}); pg.wait_for_timeout(300)
    pg.evaluate("1")
    pg2, e = open_editor(br); errors += e; open_panel(pg2)
    pg2.get_by_role("tab", name="Add a section").click(); pg2.wait_for_timeout(300)
    check("With nothing selected, new sections go above Also in this category", "Outcomes" in pg2.locator(".sec-where select option:checked").inner_text())
    for name in ["Statement", "Space"]:
        pg2.get_by_role("tab", name="Add a section").click(); pg2.wait_for_timeout(200)
        pg2.locator(".sec-option", has_text=name).first.click(); pg2.wait_for_timeout(900)
    types = [i["type"] for i in saved(pg2)["content"]]
    check("Each kind adds the right block", types.count("Spacer") == 1 and types.count("Text") == 1 and "Image" not in types and "Grid" not in types, str(types))
    check("The page shows both new sections", len(page_order(pg2)) == 13, str(len(page_order(pg2))))
    pg2.reload(wait_until="networkidle"); pg2.wait_for_timeout(2500); open_panel(pg2)
    check("After a reload the new sections are still there", len(rows(pg2)) == 13, str(len(rows(pg2))))
    pg2.close()

    # 9. Narrow screens: the panel fits, the rows stay large enough to tap, nothing overflows.
    for w, h in [(1024, 768), (768, 1024), (390, 844), (375, 667)]:
        pg3, e = open_editor(br, w=w, h=h); errors += e; open_panel(pg3)
        panel = pg3.locator(".sec-panel").bounding_box()
        go = pg3.locator(".sec-go").first.bounding_box(); more = pg3.locator(".sec-more").first.bounding_box()
        over = pg3.evaluate("document.documentElement.scrollWidth > innerWidth")
        check(f"{w}px: panel fits and targets are at least 44px", panel and panel["width"] <= w and go["height"] >= 44 and more["height"] >= 44 and more["width"] >= 44 and not over, f"{panel and round(panel['width'])} {go['height']} {more['width']}x{more['height']} overflow={over}")
        pg3.close()

    check("No script errors", not errors, str(errors[:2]))
    print(f"{sum(res)} of {len(res)} passed")
