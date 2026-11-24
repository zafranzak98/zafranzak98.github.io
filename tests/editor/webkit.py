# The main editing tasks in WebKit, the engine Safari is built on, using WebKitGTK and its own WebDriver
# (Playwright's WebKit cannot be downloaded in this workspace). This checks the engine: layout, CSS and
# scripts. It is NOT Safari and NOT an Apple device: Safari's own interface, Apple fonts, iPad and
# iPhone touch still need a person on real devices.
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

        # A part chosen from its section's list in Sections (item 8).
        ActionChains(d).send_keys(Keys.ESCAPE).perform(); time.sleep(0.3)
        if not btn(d, "[role='tab']", "On this page"): btn(d, "button, [role='button']", "Sections").click(); time.sleep(0.6)
        btn(d, "[role='tab']", "On this page").click(); time.sleep(0.4)
        js(d, "document.querySelector('.sec-row .sec-toggle[aria-label=\"Parts of Opening\"]').scrollIntoView({block:'center'})"); time.sleep(0.3)
        tg = btn(d, ".sec-toggle[aria-label='Parts of Opening']")
        if tg.get_attribute("aria-expanded") != "true": tg.click(); time.sleep(0.6)  # it may already be open (a part was selected)
        btn(d, ".sec-parts button", "Title").click(); time.sleep(0.9)
        check(f"{w}px: choosing a part in Sections selects it", name(d) == "Title", name(d))

        # Add a section offers what needs no photo; a photo already on the page can be selected.
        # Photos are placed in the website editor (Sveltia), so the page gets one from a saved draft.
        ActionChains(d).send_keys(Keys.ESCAPE).perform(); time.sleep(0.3)
        if not btn(d, "[role='tab']", "Add a section"): btn(d, "button, [role='button']", "Sections").click(); time.sleep(0.6)
        btn(d, "[role='tab']", "Add a section").click(); time.sleep(0.4)
        opts = js(d, "return [...document.querySelectorAll('.sec-option .sec-name')].map(e => e.innerText.trim())")
        check(f"{w}px: Add a section offers Text, Statement and Space", opts[:3] == ["Text", "Statement", "Space"] and not any("image" in o.lower() for o in opts), str(opts))
        sp = [b for b in d.find_elements(By.CSS_SELECTOR, ".sec-option") if b.find_element(By.CSS_SELECTOR, ".sec-name").get_attribute("textContent").strip() == "Space"][0]
        js(d, "arguments[0].scrollIntoView({block: 'center'})", sp); time.sleep(0.3); sp.click(); time.sleep(1.5)
        errors += js(d, "return window.__errs")
        key = "design-editor:about-face-beauty:unsaved"
        draft = js(d, f"return JSON.parse(localStorage.getItem('{key}'))")
        draft["content"].append({"type": "Image", "props": {"id": "Image-seeded", "image": "/media/projects/about-face-beauty/brand-proposal-cover-art.webp", "alt": "Test photo", "ratio": "auto", "fit": "cover", "focusX": 50, "focusY": 50}})
        d.get(URL.split("/admin/")[0] + "/"); time.sleep(1)  # leave the editor first: it stores its own draft as it closes
        js(d, "localStorage.setItem(arguments[0], arguments[1])", key, json.dumps(draft))
        d.get(URL); time.sleep(4)
        d.execute_script("window.__errs = []; addEventListener('error', e => __errs.push(String(e.message))); addEventListener('unhandledrejection', e => __errs.push(String(e.reason)))")
        click_part(d, ".free-photo"); time.sleep(1.2)  # brings it into view, so the lazy-loaded photo loads
        shown = js(d, "const i = document.getElementById('preview-frame').contentDocument.querySelector('.free-photo img'); return i ? i.naturalWidth : 0")
        check(f"{w}px: a photo already on the page shows", shown > 0, str(shown))
        check(f"{w}px: selecting the photo selects it", "Photo" in name(d), name(d))
        check(f"{w}px: there is no Choose or Replace photo button", not js(d, "return [...document.querySelectorAll('button')].some(b => /choose a photo|replace photo/i.test(b.innerText + ' ' + (b.getAttribute('aria-label') || '')))"))

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

# Final refinements in WebKit: formatted words, project photo presentation, page links, the settings panel.
FR = "return document.getElementById('preview-frame').contentDocument"
for w, h in [(1440, 900), (1024, 768), (390, 844)]:
    d = start(w, h)
    try:
        if w < 638 and js(d, "return !!document.querySelector('.sec-panel') && document.querySelector('.sec-panel').offsetParent !== null"):
            ActionChains(d).send_keys(Keys.ESCAPE).perform(); time.sleep(0.4)
        # F: select one word while typing and make it bold with the toolbar button.
        click_part(d, "[data-el='line']")
        btn(d, ".ctx button[aria-label='Edit words']").click(); time.sleep(0.8)
        typing = js(d, FR + ".querySelector('.el-typing')?.getAttribute('contenteditable')")
        check(f"{w}px: formatted words are typed in a rich copy", typing == "true", str(typing))
        js(d, """const doc = document.getElementById('preview-frame').contentDocument, box = doc.querySelector('.el-typing'), t = box.firstChild
          const r = doc.createRange(); r.setStart(t, 0); r.setEnd(t, 5); const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(r)""")
        b = btn(d, ".ctx-format button[aria-label='Bold']")
        a = ActionBuilder(d); a.pointer_action.move_to_location(*js(d, "const r = arguments[0].getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]", b)).click(); a.perform(); time.sleep(0.4)
        bolded = js(d, FR + ".querySelector('.el-typing b, .el-typing strong')?.innerText || ''")
        check(f"{w}px: Bold formats only the selected word and typing continues", bolded == "Three" and js(d, FR + ".querySelector('.el-typing') !== null"), bolded)
        js(d, FR + ".querySelector('.el-typing').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))"); time.sleep(1.2)
        page = js(d, FR + ".querySelector(\"[data-el='line'] strong\")?.innerText || ''")
        check(f"{w}px: the page shows the word bold after finishing", page == "Three", page)
        # A: Enter on a page link keeps the editable page.
        ActionChains(d).send_keys(Keys.ESCAPE).perform(); time.sleep(0.3)
        url0 = js(d, FR + ".URL")
        js(d, FR + ".querySelector(\"a[href='/projects/brand-communications/fc-yeah/']\").focus()")
        js(d, FR + ".querySelector(\"a[href='/projects/brand-communications/fc-yeah/']\").click()"); time.sleep(1.5)
        check(f"{w}px: a page link does not replace the page being edited", js(d, FR + ".URL") == url0 and js(d, FR + ".querySelectorAll('[data-el]').length") > 20)
        errors += js(d, "return window.__errs")
    finally:
        d.quit()
# C: a project photo's shape, in WebKit, on Cancel Me, Not!
URL_CMN = URL.replace("about-face-beauty", "cancel-me-not")
for w, h in [(1440, 900), (1024, 768)]:
    o = webdriver.WebKitGTKOptions(); o.set_capability("webkitgtk:browserOptions", {"binary": BROWSER, "args": ["--automation", "--headless"]})
    d = webdriver.WebKitGTK(options=o, service=webdriver.WebKitGTKService(executable_path="/usr/bin/WebKitWebDriver")); d.set_window_size(w, h)
    try:
        d.get(URL_CMN); time.sleep(2); d.execute_script("localStorage.clear()"); d.get(URL_CMN); time.sleep(4)
        d.execute_script("window.__errs = []; addEventListener('error', e => __errs.push(String(e.message)))")
        click_part(d, "#work [data-el='key']")
        st = btn(d, ".ctx .ctx-settings")
        if st and st.get_attribute("aria-pressed") != "true": st.click(); time.sleep(0.8)
        # B: nothing in the settings panel sticks out of it.
        out = js(d, """const p = [...document.querySelectorAll('.el-panel')].find(x => x.getBoundingClientRect().width > 0); const r = p.getBoundingClientRect()
          return [...p.querySelectorAll('button, select, input')].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > Math.min(r.right, innerWidth) + 1).length""")
        check(f"{w}px: nothing in the photo settings is cut off", out == 0, str(out))
        # Choose from the Shape list the way the browser reports a choice (WebDriver cannot open a native list here).
        pick = """const s = document.querySelector("section.el-group[aria-label='Look: Photo'] select[aria-label='Shape']"); s.scrollIntoView({ block: 'center' })
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, arguments[0]); s.dispatchEvent(new Event('change', { bubbles: true }))"""
        js(d, pick, "1/1"); time.sleep(1)
        ratio = js(d, FR + ".querySelector(\"#work [data-el='key'] img\").getBoundingClientRect(); return null") if False else js(d, "const r = document.getElementById('preview-frame').contentDocument.querySelector(\"#work [data-el='key'] img\").getBoundingClientRect(); return r.width / r.height")
        check(f"{w}px: Shape Square makes the project photo square", abs(ratio - 1) < 0.02, f"{ratio:.3f}")
        js(d, pick, "auto"); time.sleep(1)
        own = js(d, "const i = document.getElementById('preview-frame').contentDocument.querySelector(\"#work [data-el='key'] img\"); const r = i.getBoundingClientRect(); return [r.width / r.height, i.naturalWidth / i.naturalHeight]")
        check(f"{w}px: Its own shape shows the whole photo uncropped", abs(own[0] - own[1]) < 0.02, str(own))
        errors += js(d, "return window.__errs")
    finally:
        d.quit()

check("No script errors in WebKit", not errors, str(errors[:3]))
print(f"{sum(res)} of {len(res)} passed")
