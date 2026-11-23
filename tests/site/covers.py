# Project covers across the website: every place a cover appears, every project, at seven widths.
# A cover must not be cropped by more than 2% of its width or height, and no image on these pages
# may be stretched. Run from the repository root after `bun run build` and
# `python3 tests/editor/serve.py dist 4310 &` (or pass another address).
import sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4310"
WIDTHS = [(1920, 1080), (1440, 900), (1280, 800), (1024, 768), (768, 1024), (390, 844), (375, 667)]
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)

# For each <img> on the page: how much of the picture its box shows. object-fit cover crops the
# share by which the box's shape differs from the picture's; fill stretches it instead.
MEASURE = """(sel) => [...document.querySelectorAll(sel)].filter(i => i.offsetWidth && i.naturalWidth).map(i => {
  const box = i.offsetWidth / i.offsetHeight, pic = i.naturalWidth / i.naturalHeight, fit = getComputedStyle(i).objectFit
  const off = Math.abs(box - pic) / pic
  return { file: decodeURIComponent(i.currentSrc.split('/').pop()), fit, crop: fit === 'cover' ? off : 0, stretch: (fit === 'fill' || fit === '') ? off : 0 }
})"""
COVER = "/media/projects/"
def covers(items): return [i for i in items if any(k in i["file"] for k in ("cover", "logo-mouth", "brand-proposal"))]

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    pg0 = br.new_page(); pg0.goto(BASE + "/projects/", wait_until="networkidle")
    projects = pg0.evaluate("[...new Set([...document.querySelectorAll('a[href*=\"/projects/\"]')].map(a => new URL(a.href).pathname).filter(h => h.split('/').filter(Boolean).length === 3))]")
    cats = pg0.evaluate("[...new Set([...document.querySelectorAll('a[href*=\"/projects/\"]')].map(a => new URL(a.href).pathname).filter(h => h.split('/').filter(Boolean).length === 2))]")
    pg0.close()
    print(f"Projects: {len(projects)}; category pages: {len(cats)}")
    pages = ["/", "/projects/"] + cats + projects
    for w, h in WIDTHS:
        pg = br.new_page(viewport={"width": w, "height": h}); pg.on("pageerror", lambda e: errs.append(str(e)))
        for path in pages:
            pg.goto(BASE + path, wait_until="networkidle")
            pg.evaluate("async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)) } scrollTo(0, 0) }")
            pg.wait_for_timeout(300)
            found = pg.evaluate(MEASURE, "main img")
            if path == "/":
                # The home preview appears on hover, one project at a time.
                for link in pg.locator(".work-link").all():
                    if not link.is_visible(): continue
                    link.hover(); pg.wait_for_timeout(500)
                    pg.wait_for_function("!document.querySelector('.home-preview img') || document.querySelector('.home-preview img').complete")
                    found += pg.evaluate(MEASURE, ".home-preview img")
            cv = covers(found)
            worst = max([c["crop"] for c in cv] or [0])
            check(f"{w}px {path}: covers cropped at most 2% ({len(cv)} shown)", worst <= 0.02, ", ".join(f"{c['file']} {c['crop']:.1%}" for c in cv if c["crop"] > 0.005)[:300])
            stretched = [i for i in found if i["stretch"] > 0.02]
            check(f"{w}px {path}: no image stretched", not stretched, json.dumps(stretched)[:200])
        pg.close()
    check("No script errors", not errs, str(errs[:2]))
    print(f"{sum(res)} of {len(res)} passed")
