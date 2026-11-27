# End-to-end acceptance test of the REAL (not demo) save path of the visual editor: every page, the
# shared header and footer, and two case studies are edited, saved as drafts and published against an
# in-memory GitHub replica (ghreplica.py); the committed files are read back and parsed; Versions,
# the /admin conflict choice, the two-tab choice and the build rules are tried; finally everything is
# published into one replica, the website is built from it and every change is checked as a visitor.
# Run from the repository root after `bun run build:preview` and
# `python3 tests/editor/serve.py dist 4310 &`. LIVE_E2E_SKIP_VISITOR=1 skips the build step.
import json, os, re, subprocess, sys, time
import yaml
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ghreplica import Repo
from playwright.sync_api import sync_playwright

ROOT = os.environ.get("LIVE_ROOT", "/tmp/wt-live")
PORT = int(os.environ.get("LIVE_PORT", "4310"))
SITE_PORT = int(os.environ.get("LIVE_SITE_PORT", "4311"))
SITE_DIR = os.environ.get("LIVE_SITE_DIR", "/tmp/e2e-site")
BASE = f"http://zafranzak98.github.io:{PORT}/admin/design/"
ENTRY = json.dumps({"backendName": "github", "id": 1, "login": "zafranzak98", "token": "ghu_" + "A" * 36, "refreshToken": "ghr_" + "R" * 60})
ONLY = [x for x in os.environ.get("LIVE_ONLY", "").split(",") if x]

res, fails, errors = [], [], []
def check(name, ok, detail=""):
    ok = bool(ok); res.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""), flush=True)
    if not ok: fails.append((name, str(detail)[:400]))
    return ok

# ---- What each page changes: (part, field, file or None, path in the file's YAML).
CATS = ["editorial", "brand-communications", "brand-identity", "trend-research"]
def spec(key):
    s = {"key": key}
    if key == "home":
        s.update(file=("intro", "home_intro", "content/site.yml", ["home_intro"]), own=("cv-view", "labels:cv_view"), design="availability", url="/")
    elif key == "about":
        s.update(file=("intro", "intro", "content/about.md", ["intro"]), own=("intro-heading", "labels:intro"), design="kicker", url="/about/")
    elif key == "projects":
        s.update(file=("intro", "intro", "content/site.yml", ["projects_intro"]), own=("title", "title"), design="intro", url="/projects/")
    elif key.startswith("category:"):
        c = key.split(":")[1]
        s.update(file=("intro", "intro", f"content/categories/{c}.md", ["intro"]), own=("title", f"category:{c}", f"content/categories/{c}.md", ["name"]), design="title", url=f"/projects/{c}/")
    elif key == "header":
        s.update(file=None, own=("nav-about", "nav:about"), design="nav-projects", clear=("nav-cv", "nav:cv"), url=None)
    elif key == "footer":
        s.update(file=None, own=("kicker", "kicker"), design="email", clear=("top", "top"), url=None)
    elif key.startswith("project="):
        slug = key.split("=")[1]
        md = f"content/projects/{slug}.md"
        cat = re.search(r"^category: (\S+)", open(f"{ROOT}/{md}").read(), re.M).group(1)
        s.update(file=("line", "summary", md, ["summary"]), own=("label-role", "labels:role", md, ["labels", "role"]), design="line", url=f"/projects/{cat}/{slug}/", slug=slug)
    s["slug"] = s.get("slug") or "page-" + key.replace(":", "-")
    s["short"] = key.replace("category:", "").replace("project=", "")
    return s
KEYS = ["home", "about", "projects"] + [f"category:{c}" for c in CATS] + ["header", "footer", "project=evoke", "project=cancel-me-not"]
if ONLY: KEYS = [k for k in KEYS if k in ONLY]

# ---- Helpers.
def url(key): return BASE + ("?" + key if key.startswith("project=") else "?page=" + key)
def frame(pg): return [f for f in pg.frames if f != pg.main_frame][0]
def open_editor(ctx, key, clear=True):
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{key}: {e}"))
    pg.goto(url(key))
    if clear: pg.evaluate("e => { localStorage.clear(); localStorage.setItem('sveltia-cms.user', e) }", ENTRY)
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2500)
    return pg
def new_ctx(br, repo):
    ctx = br.new_context(viewport={"width": 1440, "height": 900}); ctx.route("https://api.github.com/**", repo.handle); return ctx
def part(pg, el): return frame(pg).locator(f"[data-el='{el}']").first
def text_of(pg, el): return (part(pg, el).text_content() or "").strip()
def click_part(pg, el, double=False):
    p = part(pg, el); p.evaluate("e => e.scrollIntoView({ block: 'center' })"); pg.wait_for_timeout(300); b = p.bounding_box()
    (pg.mouse.dblclick if double else pg.mouse.click)(b["x"] + min(6, b["width"] / 2), b["y"] + b["height"] / 2); pg.wait_for_timeout(600)
def type_part(pg, el, words):
    click_part(pg, el, double=True)
    pg.keyboard.press("ControlOrMeta+a")
    if words: pg.keyboard.type(words)
    else: pg.keyboard.press("Delete")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
def size_of(pg, el): return part(pg, el).evaluate("e => parseFloat(getComputedStyle(e).fontSize)")
def larger(pg, el):
    # A design change: one step larger, or one step smaller once the text is at the top of the scale
    # (Larger is greyed there, with the reason).
    click_part(pg, el); pg.wait_for_timeout(300)
    up = pg.locator(".ctx button[aria-label='Larger text']").first
    (pg.locator(".ctx button[aria-label='Smaller text']").first if up.get_attribute("aria-disabled") == "true" else up).click(); pg.wait_for_timeout(900)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
def unsaved(pg, slug): return json.loads(pg.evaluate(f"localStorage.getItem('design-editor:{slug}:unsaved')") or "null")
def status(pg): return (pg.locator(".editor-status").text_content() or "").strip()
def notice(pg): return " ".join(pg.locator(".editor-notice").all_inner_texts())
def wait_status(pg, prefix, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        s = status(pg)
        if s.startswith(prefix) or s.startswith("Not saved:"): return s
        pg.wait_for_timeout(300)
    return status(pg)
def open_publish(pg):
    pg.locator(".editor-bar-end .editor-primary").click()
    try: pg.wait_for_selector(".editor-panel .editor-primary:not([disabled])", timeout=15000)
    except Exception: pass
    pg.wait_for_timeout(300)
def publish(pg):
    open_publish(pg)
    btn = pg.locator(".editor-panel .editor-primary")
    if not btn.count() or btn.is_disabled(): return "blocked: " + " ".join(pg.locator(".editor-panel").all_inner_texts())
    btn.click(); return wait_status(pg, "Published")
def keep_all_mine(pg):
    for _ in range(10):
        b = pg.locator(".editor-panel .editor-conflict button", has_text="Keep mine")
        if not b.count(): break
        b.first.click(); pg.wait_for_timeout(400)
def publish_checked(pg, n, label):
    """Publish; a false 'someone else changed' block is a FAIL, then Keep mine is chosen to go on testing."""
    st = publish(pg)
    check(f"[{n}] {label} says published (no false 'someone else changed' block)", st.startswith("Published"), st[:600] + " | " + notice(pg)[:300])
    if "Someone else changed" in st:
        keep_all_mine(pg)
        btn = pg.locator(".editor-panel .editor-primary")
        if btn.count() and not btn.is_disabled(): btn.click(); st = wait_status(pg, "Published")
        else: st = "still blocked: " + " ".join(pg.locator(".editor-panel").all_inner_texts())[:400]
        check(f"[{n}] {label} (workaround: Keep mine) then goes through", st.startswith("Published"), st[:600] + " | " + notice(pg)[:300])
    return st
def save_draft(pg):
    pg.locator(".editor-save").click(); return wait_status(pg, "Draft saved")
def chain(repo, ref="main"):
    out, sha = [], repo.branches[ref]
    while sha: out.append(sha); sha = repo.commits[sha]["parent"]
    return out
def changed(repo, a, b):
    fa, fb = repo.commits[a]["files"], repo.commits[b]["files"]
    return sorted(k for k in set(fa) | set(fb) if fa.get(k) != fb.get(k))
def front(text, path):
    if path.endswith(".yml"): return yaml.safe_load(text), None
    m = re.match(r"^---\n([\s\S]*?\n)---\n?([\s\S]*)$", text)
    if not m: raise ValueError(f"{path}: no front matter")
    return yaml.safe_load(m.group(1)), m.group(2)
def at(d, path):
    for k in path: d = (d or {}).get(k)
    return d
def layout_of(repo, ref, slug):
    t = repo.files(ref).get(f"content/layouts/{slug}.json")
    return json.loads(t) if t else None
def elements_of(layout, el):
    """Every non-empty style the layout gives part `el` (any section)."""
    out = []
    for item in (layout or {}).get("content", []):
        v = (item["props"].get("elements") or {}).get(el)
        if v and any(x for x in v.values()): out.append(v)
    return out
def words_in(layout): return ((layout or {}).get("root", {}).get("props", {}) or {})
def first_diff_keys(a, b):
    return sorted(k for k in set(a or {}) | set(b or {}) if (a or {}).get(k) != (b or {}).get(k))

# ---- Steps 1 to 6, 9, 10 on one page with a fresh replica.
def page_flow(br, key):
    s = spec(key); n = s["short"]; slug = s["slug"]
    repo = Repo(ROOT); start = repo.branches["main"]; start_files = dict(repo.files("main"))
    ctx = new_ctx(br, repo); pg = open_editor(ctx, key)
    # 1.
    check(f"[{n}] 1 opens without the Demo chip", pg.locator(".editor-chip").count() == 0)
    check(f"[{n}] 1 signed in (no Sign in button)", pg.locator(".editor-signin").count() == 0)
    opts = pg.locator(".editor-project option").evaluate_all("o => o.map(x => x.value)")
    want = [f"page:{k}" for k in ["home", "about", "projects", "header", "footer"] + [f"category:{c}" for c in CATS]] + ["case:evoke", "case:cancel-me-not"]
    check(f"[{n}] 1 page list offers every page", all(w in opts for w in want), [w for w in want if w not in opts])
    # 2. Words in a content file, an own word (or the category name), a design setting.
    one = {}
    if s["file"]: one["file"] = f"E2E {n} file one"; type_part(pg, s["file"][0], one["file"])
    one["own"] = f"E2E {n} own one"; type_part(pg, s["own"][0], one["own"])
    size0 = size_of(pg, s["design"]); larger(pg, s["design"]); size1 = size_of(pg, s["design"])
    check(f"[{n}] 2 a size step changes {s['design']} on the page", abs(size1 - size0) > 0.5, f"{size0} -> {size1}")
    for el in ([s["design"]] + (["title"] if key == "footer" else [])):
        click_part(pg, el); btn = pg.locator(".ctx button[aria-label='Larger text']").first
        print(f"  info [{n}] Larger text on {el}: disabled={btn.is_disabled() if btn.count() else 'absent'}, size step shown={pg.locator('.ctx').first.inner_text().split(chr(10))[2:5]}, font {size_of(pg, el)}px", flush=True)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    extra_files = set()
    if key == "home":
        # The weather switch: stored as a yes/no value in site.yml.
        click_part(pg, "clock")
        if pg.locator(".ctx .ctx-settings").first.get_attribute("aria-pressed") != "true": pg.locator(".ctx .ctx-settings").first.click(); pg.wait_for_timeout(600)
        box = pg.locator("label.ps-check:visible", has_text="Show the weather").locator("input").first
        if box.count() and box.is_visible(): box.uncheck(); pg.wait_for_timeout(700)
        check(f"[{n}] 2 weather switch found and turned off", box.count() and not box.is_checked())
    if s.get("clear"):
        type_part(pg, s["clear"][0], "")
        check(f"[{n}] 10 a cleared part stays empty in the editor", text_of(pg, s["clear"][0]) == "", text_of(pg, s["clear"][0]))
    pg.wait_for_timeout(600)
    data = unsaved(pg, slug) or {}
    edits = data.get("root", {}).get("props", {}).get("edits", {})
    check(f"[{n}] 2 the changed words are held as edits", (not s["file"] or edits.get(s["file"][1]) == one["file"]) and edits.get(s["own"][1]) == one["own"], edits)
    check(f"[{n}] 2 the design setting is in the layout content", elements_of(data, s["design"]), s["design"])
    # 3. Draft.
    st = save_draft(pg)
    check(f"[{n}] 3 Save draft says saved", st.startswith("Draft saved"), st + " | " + notice(pg)[:200])
    draft = layout_of(repo, "design-drafts", slug) if "design-drafts" in repo.branches else None
    dedits = words_in(draft).get("edits", {})
    check(f"[{n}] 3 drafts branch has the layout with the words", draft and dedits.get(s["own"][1]) == one["own"] and (not s["file"] or dedits.get(s["file"][1]) == one["file"]), dedits)
    check(f"[{n}] 3 drafts branch layout has the design setting", elements_of(draft, s["design"]))
    check(f"[{n}] 3 main is unchanged by a draft", repo.branches["main"] == start)
    # 4. Publish.
    st = publish(pg)
    check(f"[{n}] 4 Publish says published", st.startswith("Published"), st[:600] + " | " + notice(pg)[:300])
    c = chain(repo)
    check(f"[{n}] 4 exactly one new commit on main", len(c) == 2, len(c))
    files = changed(repo, start, repo.branches["main"]) if len(c) >= 2 else []
    expect = {f"content/layouts/{slug}.json"}
    if s["file"]: expect.add(s["file"][2])
    if len(s["own"]) > 2: expect.add(s["own"][2])
    check(f"[{n}] 4 the right files changed, nothing else", set(files) == expect, f"changed {files}, expected {sorted(expect)}")
    now = repo.files("main")
    pub1 = layout_of(repo, "main", slug)
    for path in sorted(expect - {f"content/layouts/{slug}.json"}):
        try:
            new, body = front(now[path], path); old, obody = front(start_files[path], path); ok = True
        except Exception as e:
            check(f"[{n}] 4 {path} parses", False, e); continue
        check(f"[{n}] 4 {path} parses as YAML", True)
        if body is not None: check(f"[{n}] 4 {path} body below the front matter untouched", body == obody)
        targets = [t for t in (s["file"], s["own"] if len(s["own"]) > 2 else None) if t and t[2] == path]
        for t in targets:
            want_v = one["file"] if t is s["file"] else one["own"]
            check(f"[{n}] 4 {path} {'.'.join(t[3])} = published words", at(new, t[3]) == want_v, at(new, t[3]))
        tops = {t[3][0] for t in targets} | ({"clock"} if key == "home" and path.endswith("site.yml") else set())
        check(f"[{n}] 4 {path} no other field touched", set(first_diff_keys(old, new)) <= tops, first_diff_keys(old, new))
        if key == "home" and path.endswith("site.yml"):
            check(f"[{n}] 4 clock.weather stored as boolean false", new["clock"]["weather"] is False, repr(new["clock"]["weather"]))
            check(f"[{n}] 4 clock.show still boolean true", new["clock"]["show"] is True, repr(new["clock"]["show"]))
            check(f"[{n}] 4 clock other settings untouched", {k: v for k, v in new["clock"].items() if k != "weather"} == {k: v for k, v in old["clock"].items() if k != "weather"})
    words = words_in(pub1).get("words", {})
    check(f"[{n}] 4 published layout records the own words", words.get(s["own"][1]) == one["own"] or s["own"][1].startswith("category:"), words)
    check(f"[{n}] 4 published layout keeps the design setting", elements_of(pub1, s["design"]))
    if s.get("clear"): check(f"[{n}] 10 cleared part published as empty", words.get(s["clear"][1], None) == "", repr(words.get(s["clear"][1])))
    # 5. Reload: the published words, as published.
    pg.close(); pg = open_editor(ctx, key, clear=False)
    check(f"[{n}] 5 after reload the own words show", text_of(pg, s["own"][0]) == one["own"], text_of(pg, s["own"][0]))
    if s["file"]: check(f"[{n}] 5 after reload the file words show", text_of(pg, s["file"][0]) == one["file"], text_of(pg, s["file"][0]))
    check(f"[{n}] 5 after reload the design setting shows", abs(size_of(pg, s["design"]) - size1) < 0.5, size_of(pg, s["design"]))
    check(f"[{n}] 5 after reload the status is Same as the website", status(pg) in ("Same as the website",) or status(pg).startswith("Published"), status(pg))
    # 6. A second publish, then bring back the first.
    two = {"own": f"E2E {n} own two"}
    if s["file"]: two["file"] = f"E2E {n} file two"; type_part(pg, s["file"][0], two["file"])
    type_part(pg, s["own"][0], two["own"]); larger(pg, s["design"]); size2 = size_of(pg, s["design"])
    st = publish_checked(pg, n, "6 second publish")
    check(f"[{n}] 6 second publish is one more commit", len(chain(repo)) == 3, len(chain(repo)))
    if s["file"]:
        check(f"[{n}] 6 second publish wrote the file words", at(front(repo.files("main")[s["file"][2]], s["file"][2])[0], s["file"][3]) == two["file"])
    pg.locator(".editor-more-wrap > button").click(); pg.locator(".editor-more button", has_text="Versions").click(); pg.wait_for_timeout(1500)
    rows = pg.locator(".editor-versions li").all_inner_texts()
    pubrows = [i for i, r in enumerate(rows) if r.startswith("Published")]
    check(f"[{n}] 6 Versions lists both published versions", len(pubrows) >= 2, rows)
    if pubrows:
        pg.locator(".editor-versions li").nth(pubrows[1] if len(pubrows) > 1 else pubrows[-1]).locator("button").click()  # newest first: the publish before the latest; pg.wait_for_timeout(1500)
        check(f"[{n}] 6 version 1 brings back the own words", text_of(pg, s["own"][0]) == one["own"], text_of(pg, s["own"][0]))
        if s["file"]: check(f"[{n}] 6 version 1 brings back the file words", text_of(pg, s["file"][0]) == one["file"], text_of(pg, s["file"][0]))
        check(f"[{n}] 6 version 1 brings back the layout (design size)", abs(size_of(pg, s["design"]) - size1) < 0.5, f"{size_of(pg, s['design'])} want {size1} (v2 {size2})")
        st = publish_checked(pg, n, "6 publishing version 1")
        lay = layout_of(repo, "main", slug)
        check(f"[{n}] 6 main layout content equals version 1", lay and lay["content"] == pub1["content"], "content differs")
        if s["file"]: check(f"[{n}] 6 main file words back to version 1", at(front(repo.files("main")[s["file"][2]], s["file"][2])[0], s["file"][3]) == one["file"], at(front(repo.files("main")[s["file"][2]], s["file"][2])[0], s["file"][3]))
        if len(s["own"]) > 2: check(f"[{n}] 6 main {s['own'][2]} {'.'.join(s['own'][3])} back to version 1", at(front(repo.files("main")[s["own"][2]], s["own"][2])[0], s["own"][3]) == one["own"], at(front(repo.files("main")[s["own"][2]], s["own"][2])[0], s["own"][3]))
        else: check(f"[{n}] 6 main layout own words back to version 1", words_in(lay).get("words", {}).get(s["own"][1]) == one["own"], words_in(lay).get("words", {}).get(s["own"][1]))
    # 9. Build rule on case studies: a 61-character title is refused with a reason.
    if key.startswith("project="):
        type_part(pg, "title", "T" * 61)
        before = repo.branches["main"]; open_publish(pg)
        txt = " ".join(pg.locator(".editor-panel").all_inner_texts())
        btn = pg.locator(".editor-panel .editor-primary")
        check(f"[{n}] 9 a 61-character title blocks Publish", btn.count() and btn.is_disabled(), txt[:200])
        check(f"[{n}] 9 the reason is given", "60 characters" in txt, txt[:300])
        check(f"[{n}] 9 nothing committed", repo.branches["main"] == before)
    ctx.close()

# ---- 7. Someone changes the same words in /admin.
ADMIN_OTHER = {"content/site.yml": ["availability"], "content/about.md": ["portrait_caption"], "content/projects/evoke.md": ["outcome_note"], "content/projects/cancel-me-not.md": ["outcome_note"]}
def replace_field(text, path, keys, value):
    data, body = front(text, path)
    d = data
    for k in keys[:-1]: d = d.setdefault(k, {})
    d[keys[-1]] = value
    y = yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=10000)
    return y if body is None else f"---\n{y}---\n{body}"
def conflict_flow(br, key, choice):
    s = spec(key); n = s["short"]
    if not s["file"]: return
    el, field, path, keys = s["file"]
    repo = Repo(ROOT); ctx = new_ctx(br, repo); pg = open_editor(ctx, key)
    theirs = f"E2E {n} admin words"
    other = ADMIN_OTHER.get(path, ["order"] if "categories" in path else [])
    text = replace_field(repo.files("main")[path], path, keys, theirs)
    if other: text = replace_field(text, path, other, 99 if other == ["order"] else f"E2E {n} admin other")
    repo.write(path, text)
    mine = f"E2E {n} mine"; type_part(pg, el, mine)
    open_publish(pg)
    box = pg.locator(".editor-panel .editor-conflict")
    check(f"[{n}] 7 ({choice}) Keep mine / Use theirs offered", box.count() and box.locator("button", has_text="Keep mine").count() and box.locator("button", has_text="Use theirs").count(), " ".join(pg.locator(".editor-panel").all_inner_texts())[:300])
    if not box.count(): ctx.close(); return
    box.locator("button", has_text="Keep mine" if choice == "mine" else "Use theirs").first.click(); pg.wait_for_timeout(600)
    btn = pg.locator(".editor-panel .editor-primary")
    if not btn.count(): open_publish(pg); btn = pg.locator(".editor-panel .editor-primary")
    if btn.is_disabled(): pg.wait_for_timeout(3000)
    btn.click(); st = wait_status(pg, "Published")
    check(f"[{n}] 7 ({choice}) publishes", st.startswith("Published"), st[:600] + " | " + notice(pg)[:300])
    new, _ = front(repo.files("main")[path], path)
    check(f"[{n}] 7 ({choice}) committed value is {'mine' if choice == 'mine' else 'theirs'}", at(new, keys) == (mine if choice == "mine" else theirs), at(new, keys))
    if other: check(f"[{n}] 7 ({choice}) unrelated /admin change kept", at(new, other) == (99 if other == ["order"] else f"E2E {n} admin other"), at(new, other))
    if choice == "theirs": check(f"[{n}] 7 (theirs) the editor shows their words", text_of(pg, el) == theirs, text_of(pg, el))
    ctx.close()

# ---- 8. Two tabs, different words for the same part.
def two_tabs(br, key):
    s = spec(key); n = s["short"]; el = s["own"][0]
    repo = Repo(ROOT); ctx = new_ctx(br, repo); a = open_editor(ctx, key); b = open_editor(ctx, key, clear=False)
    type_part(a, el, f"E2E {n} tab A"); a.wait_for_timeout(800)
    type_part(b, el, f"E2E {n} tab B"); b.wait_for_timeout(1200)
    bar_a = a.locator(".editor-conflict").count() and a.locator(".editor-conflict").first.is_visible()
    check(f"[{n}] 8 the choice bar appears when another tab changes the same words", bar_a, notice(a)[:200])
    if bar_a:
        a.locator(".editor-conflict button", has_text="Use the other tab").click(); a.wait_for_timeout(800)
        check(f"[{n}] 8 Use the other tab's words takes them", text_of(a, el) == f"E2E {n} tab B", text_of(a, el))
    ctx.close()

# ---- 11. Everything published into one replica, built, and visited.
def publish_all(br, repo, plan):
    for key in KEYS:
        s = spec(key); n = s["short"]
        ctx = new_ctx(br, repo); pg = open_editor(ctx, key); p = plan[key] = {"spec": s}
        if s["file"]: p["file"] = f"Visitor {n} file words"; type_part(pg, s["file"][0], p["file"])
        p["own"] = f"Visitor {n} own words"; type_part(pg, s["own"][0], p["own"])
        larger(pg, s["design"]); p["size"] = size_of(pg, s["design"]); p["dtext"] = text_of(pg, s["design"])
        if s.get("clear"): p["cleared"] = text_of(pg, s["clear"][0]); type_part(pg, s["clear"][0], "")
        if key == "home":
            click_part(pg, "clock")
            if pg.locator(".ctx .ctx-settings").first.get_attribute("aria-pressed") != "true": pg.locator(".ctx .ctx-settings").first.click(); pg.wait_for_timeout(600)
            pg.locator("label.ps-check:visible", has_text="Show the weather").locator("input").first.uncheck(); pg.wait_for_timeout(700)
            pg.keyboard.press("Escape")
            # Move the Areas of Focus section below Selected Projects with the Sections panel.
            pg.locator("[class*='_Nav-list'] [class*='_NavItem-link']").first.click(); pg.wait_for_timeout(700)
            names = [t.split("\n")[0] for t in pg.locator(".sec-row .sec-name").all_inner_texts()]
            p["rows_before"] = names
            row = pg.locator(".sec-row", has=pg.locator(".sec-name", has_text=re.compile("focus", re.I))).first
            if row.count():
                row.locator(".sec-more").click(); pg.wait_for_timeout(200); pg.locator(".sec-menu button", has_text="Move down").first.click(); pg.wait_for_timeout(800)
            p["rows_after"] = [t.split("\n")[0] for t in pg.locator(".sec-row .sec-name").all_inner_texts()]
            p["focus_after_work"] = frame(pg).evaluate("(() => { const f = document.querySelector(\"[data-el='focus-heading']\"), w = document.querySelector(\"[data-el='work-heading']\"); return !!(f && w && (w.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING)) })()")
            check("[visitor] home section moved in the editor", p["rows_before"] != p["rows_after"] and p["focus_after_work"], f"{p['rows_before']} -> {p['rows_after']}")
        st = publish(pg)
        check(f"[visitor] publish {n}", st.startswith("Published"), st[:600] + " | " + notice(pg)[:300])
        ctx.close()

def visitor(br, repo, plan):
    subprocess.run(["git", "-C", ROOT, "worktree", "remove", "--force", SITE_DIR], capture_output=True)
    subprocess.run(["rm", "-rf", SITE_DIR])
    subprocess.run(["git", "-C", ROOT, "worktree", "add", SITE_DIR, "HEAD", "--detach"], check=True, capture_output=True)
    os.symlink("/tmp/wt-uveqa/node_modules", f"{SITE_DIR}/node_modules")
    repo.export(SITE_DIR)
    b = subprocess.run("bun run build", shell=True, cwd=SITE_DIR, capture_output=True, text=True)
    check("[visitor] the website builds from the published content", b.returncode == 0, (b.stdout + b.stderr)[-1500:])
    if b.returncode: return
    srv = subprocess.Popen([sys.executable, f"{ROOT}/tests/editor/serve.py", f"{SITE_DIR}/dist", str(SITE_PORT)])
    time.sleep(1)
    try:
        ctx = br.new_context(viewport={"width": 1440, "height": 900})
        def visit(path):
            pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(f"visitor {path}: {e}"))
            r = pg.goto(f"http://localhost:{SITE_PORT}{path}", wait_until="networkidle"); pg.wait_for_timeout(500)
            return pg, r.status if r else 0
        def size_by_text(pg, words):
            return pg.evaluate("""w => { const all = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 || [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
              const hit = all.filter(e => e.textContent.trim() === w.trim()); return hit.length ? parseFloat(getComputedStyle(hit[0]).fontSize) : null }""", words)
        pages = [plan[k]["spec"]["url"] for k in plan if plan[k]["spec"]["url"]]
        hdr, ftr = plan.get("header"), plan.get("footer")
        for key, p in plan.items():
            s = p["spec"]
            if not s["url"]: continue
            pg, code = visit(s["url"]); body = pg.locator("body").text_content() or ""
            check(f"[visitor] {s['url']} loads", code == 200, code)
            if s["file"]: check(f"[visitor] {s['url']} shows the file words", p["file"] in body, p["file"])
            check(f"[visitor] {s['url']} shows the own words", p["own"] in body, p["own"])
            got = size_by_text(pg, p["dtext"])
            check(f"[visitor] {s['url']} shows the design change ({s['design']} {p['size']}px)", got is not None and abs(got - p["size"]) < 0.6, f"visitor {got}px for '{p['dtext'][:40]}'")
            if key == "home":
                order = pg.evaluate("(() => { const t = document.body.textContent; return [t.indexOf('Areas of Focus'), t.indexOf('Selected Projects')] })()")
                check("[visitor] / shows Areas of Focus moved below Selected Projects", order[0] > order[1] >= 0, order)
                cl = front(repo.files("main")["content/site.yml"], "x.yml")[0]["clock"]
                check("[visitor] site.yml clock.weather is boolean false", cl["weather"] is False, repr(cl["weather"]))
            pg.close()
        # Category names from category pages show on the Projects page filters.
        pg, _ = visit("/projects/"); body = pg.locator("body").text_content() or ""
        for c in CATS:
            k = f"category:{c}"
            if k in plan: check(f"[visitor] /projects/ shows the new {c} name", plan[k]["own"] in body, plan[k]["own"])
        pg.close()
        for path in pages + ["/projects/brand-communications/fc-yeah/"]:
            pg, _ = visit(path)
            if hdr:
                h = pg.locator("header").first
                check(f"[visitor] {path} header shows the new nav word", hdr["own"] in (h.text_content() or ""), (h.text_content() or "")[:200])
                empty = h.evaluate("e => [...e.querySelectorAll('a')].filter(a => !a.textContent.trim() && !a.querySelector('img,svg') && !a.getAttribute('aria-label')).map(a => a.outerHTML.slice(0, 120))")
                check(f"[visitor] {path} header has no empty link", not empty, empty)
                check(f"[visitor] {path} header no longer shows the cleared '{hdr['cleared']}' link", not h.locator("a", has_text=re.compile(rf"^\s*{re.escape(hdr['cleared'])}\s*$")).count())
                got = size_by_text(pg, hdr["dtext"])
                check(f"[visitor] {path} header design change", got is not None and abs(got - hdr["size"]) < 0.6, f"{got} want {hdr['size']}")
            if ftr:
                f = pg.locator("footer").last
                check(f"[visitor] {path} footer shows the new word", ftr["own"] in (f.text_content() or ""), (f.text_content() or "")[:200])
                empty = f.evaluate("e => [...e.querySelectorAll('a')].filter(a => !a.textContent.trim() && !a.querySelector('img,svg') && !a.getAttribute('aria-label')).map(a => a.outerHTML.slice(0, 120))")
                check(f"[visitor] {path} footer has no empty link", not empty, empty)
                got = size_by_text(pg, ftr["dtext"])
                check(f"[visitor] {path} footer design change", got is not None and abs(got - ftr["size"]) < 0.6, f"{got} want {ftr['size']}")
            pg.close()
        ctx.close()
    finally:
        srv.terminate()

if __name__ == "__main__":
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=[f"--host-resolver-rules=MAP zafranzak98.github.io 127.0.0.1"])
        if not os.environ.get("LIVE_E2E_ONLY_VISITOR"):
            for key in KEYS:
                print(f"==== {key}", flush=True)
                for step in (lambda: page_flow(br, key), lambda: conflict_flow(br, key, "mine"), lambda: conflict_flow(br, key, "theirs"), lambda: two_tabs(br, key)):
                    try: step()
                    except Exception as e: check(f"[{key}] ran without a test error", False, repr(e)[:300])
        if not os.environ.get("LIVE_E2E_SKIP_VISITOR"):
            print("==== visitor", flush=True)
            repo = Repo(ROOT); plan = {}
            try:
                publish_all(br, repo, plan); visitor(br, repo, plan)
            except Exception as e: check("[visitor] ran without a test error", False, repr(e)[:300])
        check("No page script errors anywhere", not errors, errors[:5])
        br.close()
    print(f"{sum(res)} of {len(res)} passed")
    for n, d in fails: print("FAILED:", n, "|", d)
