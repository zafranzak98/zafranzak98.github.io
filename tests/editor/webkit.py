# The main editing tasks in WebKit, the engine Safari is built on, using WebKitGTK and its own WebDriver
# (Playwright's WebKit cannot be downloaded in this workspace). This checks the engine: layout, CSS and
# scripts. It is NOT Safari and NOT an Apple device: Safari's own interface, Apple fonts, iPad and
# iPhone touch and VoiceOver still need a person on real devices.
# Needs: apt install webkit2gtk-driver xvfb; pip install selenium.
# Run from the repository root after `bun run build` and `python3 tests/editor/serve.py dist 4302 &`:
#   xvfb-run -a python3 tests/editor/webkit.py
import json, os, time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.actions.action_builder import ActionBuilder
res = []
def check(n, ok, d=""): ok = bool(ok); res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f"  [{d}]" if d else ""), flush=True)
URL = os.environ.get("EDITOR_URL", "http://localhost:4302/admin/design/?project=about-face-beauty")
BROWSER = os.environ.get("WEBKIT_BROWSER", "/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser")

def start(w, h):
    o = webdriver.WebKitGTKOptions()
    o.set_capability("webkitgtk:browserOptions", {"binary": BROWSER, "args": ["--automation", "--headless"]})
    d = webdriver.WebKitGTK(options=o, service=webdriver.WebKitGTKService(executable_path="/usr/bin/WebKitWebDriver"))
    d.set_window_size(w, h)
    d.get(URL); time.sleep(2); d.execute_script("localStorage.clear()"); d.get(URL); time.sleep(4)
    # Record script errors from here on.
    d.execute_script("window.__errs = []; addEventListener('error', e => __errs.push(String(e.message))); addEventListener('unhandledrejection', e => __errs.push(String(e.reason)))")
    return d
def js(d, s, *a): return d.execute_script(s, *a)
def in_frame(d, fn):
    d.switch_to.frame(d.find_element(By.ID, "preview-frame"))
    try: return fn()
    finally: d.switch_to.default_content()
def click_part(d, sel, shift=False):
    # Real pointer events at the part's place on screen (the page sits in a preview frame).
    where = """const f = document.getElementById('preview-frame'); const el = f.contentDocument.querySelector(arguments[0])
      const r = el.getBoundingClientRect(), o = f.getBoundingClientRect(), k = o.width / f.offsetWidth  // the page preview may be scaled
      return [Math.round(o.left + (r.left + 6) * k), Math.round(o.top + (r.top + r.height / 2) * k)]"""
    # Bring it to the middle of the window: scroll inside the frame, then whichever box holds the frame.
    js(d, """const f = document.getElementById('preview-frame'); f.contentDocument.querySelector(arguments[0]).scrollIntoView({ block: 'center' })
      const y = f.contentDocument.querySelector(arguments[0]).getBoundingClientRect().top + f.getBoundingClientRect().top
      let s = f.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement
      if (s) s.scrollTop += y - innerHeight / 2""", sel)
    time.sleep(0.5)
    x, y = js(d, where, sel)
    a = ActionBuilder(d)
    if shift: a.key_action.key_down(Keys.SHIFT)
    a.pointer_action.move_to_location(x, y).click()
    if shift: a.key_action.key_up(Keys.SHIFT)
    a.perform(); time.sleep(0.8)
def btn(d, css, text=None):
    for b in d.find_elements(By.CSS_SELECTOR, css):
        if b.is_displayed() and (text is None or text in b.text): return b
    return None
def name(d): return js(d, "return document.querySelector('.ctx-name')?.innerText || ''")

errors = []
for w, h in [(1440, 900), (390, 844)]:
    d = start(w, h)
    try:
        check(f"{w}px: the editor loads in WebKit", js(d, "return !!document.querySelector('.ctx') && !!document.getElementById('preview-frame')"))
        if w < 638 and js(d, "return !!document.querySelector('.sec-panel') && document.querySelector('.sec-panel').offsetParent !== null"):
            ActionChains(d).send_keys(Keys.ESCAPE).perform(); time.sleep(0.4)

        click_part(d, "[data-el='line']")
        check(f"{w}px: clicking a part on the page selects it", name(d) == "Summary line", name(d))
        before = js(d, "return document.querySelector('.ctx-stepper output').innerText")
        btn(d, ".ctx button[aria-label='Larger text']").click(); time.sleep(0.5)
        after = js(d, "return document.querySelector('.ctx-stepper output').innerText")
        size = js(d, "return getComputedStyle(document.getElementById('preview-frame').contentDocument.querySelector(\"[data-el='line']\")).fontSize")
        check(f"{w}px: Larger text changes the size and the page", before != after, f"{before} -> {after}, {size}")
        btn(d, ".ctx .ctx-more").click(); time.sleep(0.4)
        items = js(d, "return [...document.querySelectorAll('.ctx-more-menu > button')].map(b => b.innerText.trim())")
        focus = js(d, "return !!document.activeElement.closest('.ctx-more-menu')")
        check(f"{w}px: More options opens with its actions and takes focus", any(i.startswith("Hide on") for i in items) and focus, str(items))
        ActionChains(d).send_keys(Keys.ESCAPE).perform(); time.sleep(0.4)
        check(f"{w}px: Escape closes it and keeps the selection", js(d, "return !document.querySelector('.ctx-more-menu')") and name(d) == "Summary line")
        unnamed = js(d, "return [...document.querySelectorAll('.ctx button')].filter(b => b.getClientRects().length && !(b.getAttribute('aria-label') || b.innerText.trim())).length")
        check(f"{w}px: every bar button has a name", unnamed == 0, str(unnamed))
        over = js(d, "return document.documentElement.scrollWidth > innerWidth + 1")
        check(f"{w}px: nothing runs off the side", not over)

        # Undo names the step and undoes it.
        undo = btn(d, ".editor-history button")
        check(f"{w}px: Undo names the change", "Summary line" in (undo.get_attribute("aria-label") or ""), undo.get_attribute("aria-label"))
        undo.click(); time.sleep(0.6)
        size2 = js(d, "return getComputedStyle(document.getElementById('preview-frame').contentDocument.querySelector(\"[data-el='line']\")).fontSize")
        check(f"{w}px: Undo puts the size back", size2 != size, f"{size} -> {size2}")

        # Phone strip.
        btn(d, ".editor-screens button", "Phone").click(); time.sleep(1.5)
        strip = js(d, "return document.querySelector('.editor-strip')?.innerText || ''")
        check(f"{w}px: editing Phone shows the strip", strip.startswith("Editing Phone."), strip[:60])
        btn(d, ".editor-screens button", "Desktop").click(); time.sleep(1.5)

        # Add an Image section and choose a photo.
        ActionChains(d).send_keys(Keys.ESCAPE).perform(); time.sleep(0.3)
        if not btn(d, "[role='tab']", "Add a section"): btn(d, "button, [role='button']", "Sections").click(); time.sleep(0.6)
        btn(d, "[role='tab']", "Add a section").click(); time.sleep(0.4)
        btn(d, ".sec-option", "One image").click(); time.sleep(1.5)
        if w < 638: ActionChains(d).send_keys(Keys.ESCAPE).perform(); time.sleep(0.4)
        btn(d, ".ctx-photo").click(); time.sleep(0.8)
        dlg = js(d, "const r = document.querySelector('.ph-dialog')?.getBoundingClientRect(); return r ? [r.width, r.height] : null")
        check(f"{w}px: the photo picker opens and fits the screen", dlg and dlg[1] <= h + 1, str(dlg))
        btn(d, ".ph-pick").click(); time.sleep(0.4)
        f = d.find_element(By.CSS_SELECTOR, ".ph-alt input"); f.send_keys("Test photo"); time.sleep(0.3)
        # Enter in the description box confirms in Chromium, but a WebDriver Enter does not reach it here
        # (a script-sent Enter does). Unclear whether Safari is affected: it is on the Safari checklist.
        btn(d, ".ph-dialog button", "Use this photo").click(); time.sleep(1.2)
        check(f"{w}px: Use this photo closes the picker", js(d, "return !document.querySelector('.ph-dialog')"))
        shown = js(d, "const i = document.getElementById('preview-frame').contentDocument.querySelector('.free-photo img'); return i ? i.naturalWidth : 0")
        check(f"{w}px: the chosen photo shows on the page", shown > 0, str(shown))

        # Save draft.
        cover = js(d, "const b = document.querySelector('.editor-save').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e.closest('.editor-save') ? '' : (e.className || e.tagName) + ' ' + (e.innerText || '').slice(0, 80)")
        check(f"{w}px: nothing covers Save draft", not cover, cover)
        js(d, "document.querySelector('.editor-save').click()"); time.sleep(1.2)
        status = js(d, "return document.querySelector('.editor-status').innerText")
        check(f"{w}px: Save draft says Draft saved", status.startswith("Draft saved"), status)
        errs = js(d, "return window.__errs")
        errors += errs
    finally:
        d.quit()

check("No script errors in WebKit", not errors, str(errors[:3]))
print(f"{sum(res)} of {len(res)} passed")
