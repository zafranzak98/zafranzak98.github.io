# "Saved" and "Live" after publishing (27 Nov 2026). Real (non-demo) editor, GitHub replaced by the
# replica, the website's /version.json and GitHub's public update-run record under the test's control.
# Checks: the editor never says live before the website serves the new version; it says live when it
# does (or serves a later version that includes it); failed, queued, slow, superseded and rate-limited
# updates; and that a page published from another tab is still refused.
# Run after `bun run build` and `python3 tests/editor/serve.py dist 4382 &`.
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from ghreplica import Repo
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
BASE = os.environ.get('EDITOR_BASE', 'http://zafranzak98.github.io:4382/admin/design/')
ENTRY = json.dumps({"backendName": "github", "id": 1, "login": "zafranzak98", "token": "ghu_" + "A" * 36, "refreshToken": "ghr_" + "R" * 60})
res = []
def check(name, ok, info=''):
    res.append(ok); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info and not ok else ''), flush=True)

class Site:
    """The website's version and GitHub's record of the update run, as the test sets them."""
    def __init__(s, repo):
        s.repo, s.served, s.run, s.compare, s.limited, s.public = repo, repo.branches['main'], None, None, False, []
    def api(s, route):
        url = route.request.url
        if '/actions/runs' in url or '/compare/' in url:
            s.public.append(url)
            if s.limited: return route.fulfill(status=403, json={'message': 'API rate limit exceeded'})
            if '/actions/runs' in url: return route.fulfill(json={'workflow_runs': [s.run] if s.run else []})
            return route.fulfill(json={'status': s.compare or 'diverged'})
        s.repo.handle(route)
    def version(s, route): route.fulfill(json={'commit': s.served}, headers={'cache-control': 'no-store'})

def publish(b, site, clock=False):
    ctx = b.new_context(viewport={'width': 1437, 'height': 900})
    ctx.route('https://api.github.com/**', site.api); ctx.route('**/version.json*', site.version)
    pg = ctx.new_page()
    if clock: pg.clock.install()
    pg.goto(BASE + '?page=home'); pg.evaluate("e=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('sveltia-cms.user',e)}", ENTRY)
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(1500)
    pg.evaluate("""window.__seen=[]; new MutationObserver(()=>{const t=document.querySelector('.editor-status-text')?.textContent; if(t&&window.__seen.at(-1)!==t) window.__seen.push(t)}).observe(document.body,{subtree:true,childList:true,characterData:true})""")
    f = [x for x in pg.frames if x != pg.main_frame][0]
    f.locator("[data-el='intro']").first.dblclick(force=True, position={'x': 5, 'y': 5}); pg.wait_for_timeout(250)
    pg.keyboard.press('End'); pg.keyboard.type(' test'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    pg.locator('.editor-primary').first.click()
    pg.wait_for_function("()=>{const b=[...document.querySelectorAll('.editor-panel .editor-primary')].pop(); return b && !b.disabled}", timeout=30000)
    pg.locator('.editor-panel .editor-primary').last.click()
    pg.wait_for_function("()=>/Saved to GitHub in|Publishing did not work|another tab or device/.test(document.body.innerText)", timeout=30000)
    return ctx, pg
status = lambda pg: pg.locator('.editor-status-text').inner_text()
notice = lambda pg: pg.locator('.editor-notice').inner_text() if pg.locator('.editor-notice').count() else ''
said_live_early = lambda pg: any(t.startswith('Live') for t in pg.evaluate('window.__seen'))

with sync_playwright() as p:
    b = p.chromium.launch(args=["--host-resolver-rules=MAP zafranzak98.github.io 127.0.0.1"])

    # 1. Normal update: saved first, live only once the website serves the new version.
    repo = Repo(ROOT); site = Site(repo); site.run = {'status': 'in_progress', 'html_url': 'https://github.com/run/1'}
    ctx, pg = publish(b, site)
    new = repo.branches['main']
    check('saving says "Saved to GitHub", not live', 'Saved to GitHub in' in notice(pg) and 'Live' not in status(pg), notice(pg))
    check('the status says the site is updating', status(pg) == 'Saved, updating site…', status(pg))
    pg.wait_for_timeout(16000)
    check('still not live while the website serves the old version (16 s)', not said_live_early(pg) and status(pg) == 'Saved, updating site…', str(pg.evaluate('window.__seen')))
    site.served = new
    pg.wait_for_function("()=>/^Live /.test(document.querySelector('.editor-status-text').textContent)", timeout=8000)
    check('live once the website serves the new version', 'Live on your website now' in notice(pg), notice(pg))
    check('the live message gives both timings', 'Saving took' in notice(pg) and 'the website update took' in notice(pg), notice(pg))
    n = len(site.public); pg.wait_for_timeout(11000)
    check('following stops once live (no more requests)', len(site.public) == n, f'{n} then {len(site.public)}')
    check('GitHub asked at most 2 times for a 20 s update', n <= 2, str(site.public))
    ctx.close()

    # 2. Failed update.
    repo = Repo(ROOT); site = Site(repo); site.run = {'status': 'completed', 'conclusion': 'failure', 'html_url': 'https://github.com/run/2'}
    ctx, pg = publish(b, site)
    pg.wait_for_function("()=>/website update failed/.test(document.body.innerText)", timeout=8000)
    check('a failed update is reported, not live', status(pg) == 'Saved, site not updated' and not said_live_early(pg), status(pg))
    ctx.close()

    # 3. Queued update, then superseded by a later publish that includes this one.
    repo = Repo(ROOT); site = Site(repo); site.run = {'status': 'queued', 'html_url': 'https://github.com/run/3'}
    ctx, pg = publish(b, site)
    pg.wait_for_timeout(7000)
    check('a queued update shows as updating, not live', status(pg) == 'Saved, updating site…', status(pg))
    site.run = {'status': 'completed', 'conclusion': 'cancelled', 'html_url': 'https://github.com/run/3'}
    pg.wait_for_timeout(16000)
    check('a cancelled (replaced) update is not reported as failed', 'failed' not in notice(pg) and not said_live_early(pg), status(pg))
    site.served, site.compare = 'later' + '0' * 35, 'ahead'
    pg.wait_for_function("()=>/^Live /.test(document.querySelector('.editor-status-text').textContent)", timeout=8000)
    check('live when the website serves a later version that includes the change', 'Live on your website now' in notice(pg))
    check('GitHub compared that later version once', sum('/compare/' in u for u in site.public) == 1, str(site.public))
    ctx.close()

    # 4. Rate limited by GitHub: stops asking it, and still says live from the website alone.
    repo = Repo(ROOT); site = Site(repo); site.limited = True
    ctx, pg = publish(b, site)
    pg.wait_for_timeout(22000)
    check('after a refusal GitHub is not asked again', len(site.public) == 1, str(site.public))
    check('still saved and updating, not live', status(pg) == 'Saved, updating site…' and not said_live_early(pg), status(pg))
    site.served = repo.branches['main']
    pg.wait_for_function("()=>/^Live /.test(document.querySelector('.editor-status-text').textContent)", timeout=8000)
    check('live from the website alone', 'Live on your website now' in notice(pg))
    ctx.close()

    # 5. Slow, then no answer after ten minutes (time moved forward).
    repo = Repo(ROOT); site = Site(repo); site.run = {'status': 'in_progress', 'html_url': 'https://github.com/run/5'}
    ctx, pg = publish(b, site, clock=True)
    pg.clock.fast_forward('03:05'); pg.wait_for_timeout(500); pg.clock.fast_forward('00:06'); pg.wait_for_timeout(800)
    check('after three minutes it says the update is slow', status(pg) == 'Saved, update is slow…' and 'longer than usual' in notice(pg), f'{status(pg)} | {notice(pg)}')
    pg.clock.fast_forward('07:05'); pg.wait_for_timeout(500); pg.clock.fast_forward('00:06'); pg.wait_for_timeout(800)
    check('after ten minutes it stops and says it could not confirm', 'could not be confirmed' in notice(pg) and not said_live_early(pg), notice(pg))
    check('the status then stays factual ("Saved …")', status(pg).startswith('Saved '), status(pg))
    ctx.close()

    # 6. The page was published from another tab after this one opened: still refused, nothing saved.
    repo = Repo(ROOT); site = Site(repo)
    ctx = b.new_context(viewport={'width': 1437, 'height': 900}); ctx.route('https://api.github.com/**', site.api); ctx.route('**/version.json*', site.version)
    pg = ctx.new_page(); pg.goto(BASE + '?page=home'); pg.evaluate("e=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('sveltia-cms.user',e)}", ENTRY)
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(1500)
    path = 'content/layouts/page-home.json'
    other = json.loads(repo.files('main').get(path) or '{"content":[],"root":{"props":{}}}')
    other.setdefault('root', {}).setdefault('props', {}).setdefault('words', {})['kicker'] = 'From another tab'
    repo.write(path, json.dumps(other, indent=2) + '\n'); head = repo.branches['main']
    f = [x for x in pg.frames if x != pg.main_frame][0]
    f.locator("[data-el='intro']").first.dblclick(force=True, position={'x': 5, 'y': 5}); pg.wait_for_timeout(250)
    pg.keyboard.press('End'); pg.keyboard.type(' test'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    pg.locator('.editor-primary').first.click()
    pg.wait_for_function("()=>{const b=[...document.querySelectorAll('.editor-panel .editor-primary')].pop(); return b && !b.disabled}", timeout=30000)
    pg.locator('.editor-panel .editor-primary').last.click()
    pg.wait_for_function("()=>/another tab or device/.test(document.body.innerText)", timeout=30000)
    check('a page published from another tab is refused through the new save', repo.branches['main'] == head and 'Live' not in status(pg), status(pg))
    ctx.close()
    b.close()
print(f'\n{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
