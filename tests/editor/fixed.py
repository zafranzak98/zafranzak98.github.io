# Fixed parts (26 Nov 2026): on every page Delete and Backspace never remove a section while a part is
# chosen; the Header and Footer are never removed, copied or moved, and each of their words can be cleared,
# stays choosable, refills, hides in Preview, publishes, and leaves no empty link for visitors.
# Run after `bun run build:preview` and `python3 tests/editor/serve.py dist 4302 &`.
import json
from playwright.sync_api import sync_playwright
B='http://localhost:4302/admin/design/'
PAGES=['home','about','projects','category:editorial','category:brand-communications','category:brand-identity','category:trend-research','header','footer']
CASES=['cancel-me-not','fc-yeah','evoke','af-binary','bersihmalaysia','beyondbinary','we-matter-too-the-handbook-of-lgbtq']
res=[]
def check(name, ok, info=''):
    res.append(ok); print(('PASS ' if ok else 'FAIL ')+name+(f'  [{info}]' if info and not ok else ''))
def frame(pg): return [x for x in pg.frames if x!=pg.main_frame][0]
def count(pg): return frame(pg).evaluate("document.querySelectorAll('[data-puck-component]').length")
with sync_playwright() as p:
    b=p.chromium.launch()
    # 1. Every page: choose up to 3 parts, press Delete and Backspace; no section disappears.
    for key in PAGES+['project='+c for c in CASES]:
        ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page()
        pg.goto(B+('?'+key if key.startswith('project=') else '?page='+key),wait_until='networkidle'); pg.wait_for_timeout(1500)
        f=frame(pg); n0=count(pg)
        parts=f.evaluate("[...document.querySelectorAll('[data-el]')].filter(e=>e.getBoundingClientRect().width>4&&!e.hasAttribute('data-shared')).map(e=>e.dataset.el)")
        pick=parts if key in ('header','footer') else parts[:3]
        lost=[]
        for k in pick:
            loc=f.locator(f"[data-el='{k}']").first
            try: loc.click(force=True,timeout=3000,position={'x':6,'y':6})
            except Exception: continue
            pg.wait_for_timeout(150); pg.keyboard.press('Delete'); pg.keyboard.press('Backspace'); pg.wait_for_timeout(250)
            if count(pg)!=n0: lost.append(k); break
        check(f'{key}: Delete/Backspace on {len(pick)} parts removes no section', not lost and count(pg)==n0, str(lost))
        ctx.close()
    # 2. Header and Footer: the section itself cannot be removed, copied or moved by any route.
    for key in ('header','footer'):
        ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page()
        pg.goto(B+'?page='+key,wait_until='networkidle'); pg.wait_for_timeout(1500); f=frame(pg); n0=count(pg)
        f.locator('[data-puck-component]').first.click(position={'x':3,'y':3},force=True); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.keyboard.press('Delete'); pg.keyboard.press('Backspace'); pg.wait_for_timeout(300)
        check(f'{key}: Delete with the section chosen leaves it in place', count(pg)==n0)
        ctx_txt=pg.locator('.editor-bar-ctx').inner_text()
        check(f'{key}: section tools offer no remove, duplicate, move or colour', not any(w in ctx_txt for w in ('Remove','Duplicate','Move up','Move down','Background')), ctx_txt[:120])
        if not pg.locator('.sec-panel:visible').count(): pg.get_by_role('button', name='Sections', exact=True).first.click(); pg.wait_for_timeout(400)
        check(f'{key}: Sections panel has no menu, drag handle or Add a section', pg.locator('.sec-more').count()==0 and pg.locator('.sec-grip[draggable]').count()==0 and pg.locator('#sec-tab-add').count()==0)
        drag=f.evaluate("[...document.querySelectorAll('[data-puck-component]')].map(e=>e.getAttribute('aria-roledescription')).join(',')")
        # 3. Every word part can be cleared on its own; the section and the part stay; it can be filled again.
        parts=f.evaluate("[...document.querySelectorAll('[data-edit]')].filter(e=>e.getBoundingClientRect().width>4).map(e=>e.dataset.el)")
        bad=[]
        for k in parts:
            loc=f.locator(f"[data-el='{k}']").first
            loc.dblclick(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(250)
            pg.keyboard.press('ControlOrMeta+a'); pg.keyboard.press('Backspace'); pg.keyboard.press('Enter'); pg.wait_for_timeout(350)
            st=f.evaluate(f"(()=>{{const e=document.querySelector(\"[data-el='{k}']\");return e?{{text:e.textContent,w:e.getBoundingClientRect().width}}:null}})()")
            if not st or st['text']!='' or st['w']<10 or count(pg)!=n0: bad.append((k,st))
        check(f'{key}: all {len(parts)} word parts cleared one by one, each stays visible and choosable, section kept', not bad, str(bad[:3]))
                undo=pg.locator('.editor-history button').first.get_attribute('aria-label') or ''
        check(f'{key}: Undo names the clearing step', 'edit' in undo.lower(), undo)
        # refill one
        k=parts[0]; f.locator(f"[data-el='{k}']").first.dblclick(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(250); pg.keyboard.type('New words'); pg.keyboard.press('Enter'); pg.wait_for_timeout(350)
        check(f'{key}: a cleared part can be filled again', f.locator(f"[data-el='{k}']").first.inner_text().strip().lower()=='new words')
        # preview hides empty parts
        pg.locator('.editor-preview').click(); pg.wait_for_timeout(600)
        vis=f.evaluate("[...document.querySelectorAll('[data-edit]')].filter(e=>e.textContent===''&&e.getBoundingClientRect().width>0).length")
        check(f'{key}: Preview shows no empty placeholders', vis==0, str(vis))
        pg.locator('.editor-preview').click(); pg.wait_for_timeout(400)
        # publish (simulated) works
        pg.locator('.editor-primary').click(); pg.wait_for_timeout(1500)
        btn=pg.locator('.editor-panel .editor-primary')
        info=f"count={btn.count()} enabled={btn.first.is_enabled() if btn.count() else None}"
        if btn.count(): btn.first.click(); pg.wait_for_timeout(1500)
        msg=pg.locator('.editor-notice, [role=status]').all_inner_texts()
        check(f'{key}: publishing (simulated) with cleared words works', any('Published' in m for m in msg), info+' '+str(msg)[:200])
        ctx.close()
    # 4. Another page shows the published, cleared header: no empty link, the section is there.
    ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page()
    pg.goto(B+'?page=header',wait_until='networkidle'); pg.wait_for_timeout(1200); f=frame(pg)
    f.locator("[data-el='nav-about']").first.dblclick(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(250); pg.keyboard.press('ControlOrMeta+a'); pg.keyboard.press('Backspace'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    pg.locator('.editor-primary').click(); pg.wait_for_timeout(1500); pg.locator('.editor-panel .editor-primary').first.click(); pg.wait_for_timeout(1500)
    pg.goto(B+'?page=home',wait_until='networkidle'); pg.wait_for_timeout(1500); f=frame(pg)
    links=f.evaluate("[...document.querySelectorAll('header a')].filter(a=>!a.textContent.trim() && !a.getAttribute('aria-label')).length")
    check('home: the shared header is there after publishing a cleared menu item', f.locator('header').count()==1)
    check('home: no empty link in the header', links==0, str(links))
    ctx.close()
    # 5. Other pages: clearing a required part keeps the words and says why.
    ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page()
    pg.goto(B+'?page=about',wait_until='networkidle'); pg.wait_for_timeout(1500); f=frame(pg)
    before=f.locator("[data-el='intro-heading']").inner_text()
    f.locator("[data-el='intro-heading']").dblclick(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(250); pg.keyboard.press('ControlOrMeta+a'); pg.keyboard.press('Backspace'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    check('about: clearing a heading keeps its words', f.locator("[data-el='intro-heading']").inner_text()==before)
    check('about: and says why, pointing to Hide', 'Hide' in pg.locator('.editor-bar-ctx').inner_text(), pg.locator('.editor-bar-ctx').inner_text()[:150])
    ctx.close()
    b.close()
print(f'{sum(res)} of {len(res)} passed')
