# Puts sections into the editor's unsaved draft before the page starts, the way a page saved
# earlier would hold them. Photos are placed in the website editor (Sveltia), not in this editor,
# so tests that need a photo on the page get it this way. The editor stores its own draft as a page
# unloads, so the seeded draft is written as the reloaded page starts (once per tab).
import json
KEY = "design-editor:about-face-beauty:unsaved"
PHOTOS = {"brand proposal cover art": "/media/projects/about-face-beauty/brand-proposal-cover-art.webp",
          "d title": "/media/projects/cancel-me-not/d-title.jpg"}
def image(path, alt="Test photo", id="Image-seeded"):
    return {"type": "Image", "props": {"id": id, "image": path, "alt": alt, "ratio": "auto", "fit": "cover", "focusX": 50, "focusY": 50}}
def seed(pg, items):
    """Adds a Space section to get a draft, appends items to it, and reloads with that draft."""
    if not pg.get_by_role("tab", name="Add a section").is_visible():
        pg.get_by_role("button", name="Sections").first.click(); pg.wait_for_timeout(500)
    pg.get_by_role("tab", name="Add a section").click(); pg.wait_for_timeout(300)
    pg.locator(".sec-option", has_text="Space").first.click(); pg.wait_for_timeout(1500)
    d = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))"); d["content"] += items
    pg.context.add_init_script(f"if (!sessionStorage.getItem('seeded')) {{ localStorage.setItem('{KEY}', {json.dumps(json.dumps(d))}); sessionStorage.setItem('seeded', '1') }}")
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    if not pg.locator(".sec-panel:visible").count() and pg.viewport_size["width"] >= 900:
        pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(600)
