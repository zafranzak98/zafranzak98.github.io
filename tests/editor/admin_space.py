# The toolbar measured in the space the editor really gets beside the demo /admin menu (open and hidden)
# at 1440, 1437 x 668 (the review profile), 1280 and 1024: one row from 1280 px of editor space, two
# clean rows below, no overlaps, nothing cut off or off screen, menu choice remembered.
# Run after `bun run build:preview` and `python3 tests/editor/serve.py dist 4302 &`.
import json
from playwright.sync_api import sync_playwright
import os
AXE=open(os.environ.get('AXE','/tmp/axe/node_modules/axe-core/axe.min.js')).read()
M="""(()=>{const k=[...document.querySelectorAll('.editor-bar-start .editor-field, .editor-chip, .editor-history button, .editor-screens, .editor-width, .editor-status, .editor-preview, .editor-more-btn, .editor-save, .editor-primary')].filter(e=>e.offsetParent!==null);
const R=k.map(e=>{const r=e.getBoundingClientRect();return {c:e.className.split(' ')[0],t:r.top,b:r.bottom,l:r.left,r:r.right,cut:e.scrollWidth>e.clientWidth+1}});
const rows=new Set(R.map(x=>Math.round((x.t+x.b)/2/20)));let ov=0;for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i],c=R[j];if(a.l<c.r-1&&c.l<a.r-1&&a.t<c.b-1&&c.t<a.b-1)ov++}
return {space:innerWidth,rows:rows.size,overlaps:ov,cut:R.filter(x=>x.cut).length,offscreen:R.filter(x=>x.r>innerWidth+1).length}})()"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in [(1440,900),(1437,668),(1280,800),(1024,768)]:
        for menu in ('default','toggled'):
            c=b.new_context(viewport={'width':w,'height':h}); pg=c.new_page(); errs=[]
            pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
            pg.goto('http://localhost:4302/admin/design/',wait_until='networkidle'); pg.wait_for_timeout(1500)
            if menu=='toggled': pg.locator('.adm-menu-btn').click(); pg.wait_for_timeout(1200)
            side=pg.locator('#adm-side').is_visible()
            f=pg.frame_locator('.adm-frame'); fr=[x for x in pg.frames if x!=pg.main_frame][0]
            r=fr.evaluate(M)
            if menu=='toggled':
                pg.reload(wait_until='networkidle'); pg.wait_for_timeout(800); r['remembered']=pg.locator('#adm-side').is_visible()==side
            print(w,menu,'menu open' if side else 'menu hidden',json.dumps(r),'errors',len(errs))
                        c.close()
    c=b.new_context(viewport={'width':1437,'height':668}); pg=c.new_page(); pg.goto('http://localhost:4302/admin/design/',wait_until='networkidle'); pg.wait_for_timeout(1500)
    pg.add_script_tag(content=AXE); print('axe', pg.evaluate("async()=> (await axe.run(document,{runOnly:['wcag2a','wcag2aa']})).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)"))
    b.close()
