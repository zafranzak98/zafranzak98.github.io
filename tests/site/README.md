# Website checks

`covers.py` opens every page that shows project covers (home page, Projects page, each category page and each project page) at 1920, 1440, 1280, 1024, 768, 390 and 375 px, hovers each home page project, and checks that no cover is cropped by more than 2% and no image is stretched.

```bash
bun run build
python3 tests/editor/serve.py dist 4310 &   # on the editor-ux branch; any static server works
python3 tests/site/covers.py                # or: python3 tests/site/covers.py http://localhost:PORT
```

Needs Python 3 with Playwright (`pip install playwright`, then `playwright install chromium`).
