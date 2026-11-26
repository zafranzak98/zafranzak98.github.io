# Headline line breaks in the visual editor (26 Nov 2026): Shift+Enter adds a line break to the homepage
# headline, typed on the page or in the Settings words box; breaks already in the words are kept when the
# headline is edited again; other text never takes one; phones show the headline without them.
# Run after `bun run build:preview` and `python3 tests/editor/serve.py dist 4302 &`.
from playwright.sync_api import sync_playwright
B='http://localhost:4302/admin/design/?page=home'
res=[]
def check(name, ok, info=''):
    res.append(ok); print(('PASS ' if ok else 'FAIL ')+name+(f'  [{info}]' if info and not ok else ''))
def frame(pg): return [x for x in pg.frames if x!=pg.main_frame][0]
def brs(f, k='intro'): return f.evaluate(f"document.querySelector(\"[data-el='{k}']\").querySelectorAll('br').length")
def text(f, k='intro'): return f.evaluate(f"document.querySelector(\"[data-el='{k}']\").innerText")
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1437,'height':668}); pg=ctx.new_page()
    pg.goto(B,wait_until='networkidle'); pg.wait_for_timeout(1500); f=frame(pg)
    head=f.locator("[data-el='intro']").first
    # 1. Type a headline with a line break on the page.
    head.dblclick(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(250)
    hint=f.evaluate("document.querySelector('.el-typing + *, .el-typing ~ div')?.textContent||''")
    check('typing hint mentions Shift+Enter for the headline', 'Shift+Enter' in hint, hint)
    pg.keyboard.press('ControlOrMeta+a'); pg.keyboard.type('I turn conversations'); pg.keyboard.press('Shift+Enter'); pg.keyboard.type('into campaigns.'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('Shift+Enter on the page adds one line break', brs(f)==1, f'{brs(f)} {text(f)!r}')
    check('Enter still finishes typing', f.locator('.el-typing').count()==0)
    # 2. Edit again without changes: the break is kept.
    head.dblclick(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(250)
    check('the editable copy shows the existing break', f.evaluate("document.querySelector('.el-typing').querySelectorAll('br').length")>=1)
    pg.keyboard.press('End'); pg.keyboard.type(' Today'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('editing again keeps the break', brs(f)==1 and 'Today' in text(f), text(f))
    # 3. Settings words box keeps it and accepts Shift+Enter.
    head.click(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(300)
    if not pg.locator('.el-words-rich:visible').count():
        pg.get_by_role('button', name='Settings').first.click(); pg.wait_for_timeout(400)
    box=pg.locator('.el-words-rich:visible').first
    check('Settings words box shows the break', box.count()==1 and box.evaluate("e=>e.querySelectorAll('br').length")>=1)
    check('Settings words box is marked multi-line for the headline', box.get_attribute('aria-multiline')=='true')
    box.click(); pg.keyboard.press('ControlOrMeta+End'); pg.keyboard.type(' now'); pg.wait_for_timeout(400)
    check('typing in Settings keeps the break on the page', brs(f)==1 and text(f).strip().endswith('now'), text(f))
    pg.keyboard.press('Shift+Enter'); pg.keyboard.type('Third'); pg.wait_for_timeout(400)
    check('Shift+Enter in Settings adds a second line', brs(f)==2, text(f))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    check('plain Enter in Settings adds no line', brs(f)==2)
    # 4. Other text takes no break.
    by=f.locator("[data-el='byline']").first
    by.dblclick(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(250)
    pg.keyboard.press('End'); pg.keyboard.press('Shift+Enter'); pg.keyboard.type('x'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('name line never takes a line break', brs(f,'byline')==0, text(f,'byline'))
    # 5. Undo and Redo bring the break back exactly.
    pg.locator('.editor-history button').first.click(); pg.wait_for_timeout(300)
    pg.locator('.editor-history button').first.click(); pg.wait_for_timeout(300)
    check('Undo steps back through the headline edits', brs(f)==1, text(f))
    # 6. Preview shows the breaks; a phone width hides them.
    pg.keyboard.press('Escape')
    shown=f.evaluate("[...document.querySelectorAll(\"[data-el='intro'] br\")].filter(b=>getComputedStyle(b).display!=='none').length")
    check('computer width shows the break', shown>=1)
    ctx.close()
    ctx=b.new_context(viewport={'width':390,'height':844}); pg=ctx.new_page()
    pg.goto(B,wait_until='networkidle'); pg.wait_for_timeout(1500); f=frame(pg)
    f.locator("[data-el='intro']").first.dblclick(force=True,position={'x':6,'y':6}); pg.wait_for_timeout(250)
    pg.keyboard.press('ControlOrMeta+a'); pg.keyboard.type('One'); pg.keyboard.press('Shift+Enter'); pg.keyboard.type('Two'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    vis=f.evaluate("[...document.querySelectorAll(\"[data-el='intro'] br\")].filter(b=>getComputedStyle(b).display!=='none').length")
    check('phone width keeps the break stored but fits the words to the screen', brs(f)==1 and vis==0, f'{brs(f)} {vis}')
    ctx.close(); b.close()
print(f'{sum(res)}/{len(res)} passed')
