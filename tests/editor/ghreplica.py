# A working replica of the parts of GitHub's API the visual editor uses, kept in memory: branches,
# commits, file contents, trees and history. The real editor code (not the demo) saves to it, so a
# test can publish every page, read back exactly what would be committed, and build the website from it.
import base64, hashlib, json, os, time
from urllib.parse import urlparse, parse_qs, unquote

class Repo:
    def __init__(self, root, owner='zafranzak98', name='zafranzak98.github.io'):
        files = {}
        for base, _, names in os.walk(os.path.join(root, 'content')):
            for n in names:
                full = os.path.join(base, n)
                files[os.path.relpath(full, root).replace(os.sep, '/')] = open(full, encoding='utf-8').read()
        self.prefix = f'/repos/{owner}/{name}'
        self.commits = {}
        self.trees = {}
        self.branches = {}
        self.log = []
        self.branches['main'] = self._commit(files, None, 'start')

    def _id(self, *parts):
        return hashlib.sha1(json.dumps(parts, sort_keys=True).encode() + str(time.time_ns()).encode()).hexdigest()

    def _commit(self, files, parent, message):
        sha = self._id(message, parent)
        self.commits[sha] = {'files': dict(files), 'parent': parent, 'message': message, 'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        return sha

    def files(self, ref='main'):
        sha = self.branches.get(ref, ref)
        return self.commits[sha]['files'] if sha in self.commits else None

    def write(self, path, text, message='Website editor (/admin) change', branch='main'):
        """A change made outside the visual editor, as /admin would make it."""
        files = dict(self.files(branch)); files[path] = text
        self.branches[branch] = self._commit(files, self.branches[branch], message)

    def history(self, ref, path):
        out, sha = [], self.branches.get(ref)
        while sha:
            c = self.commits[sha]
            parent = c['parent']
            before = self.commits[parent]['files'].get(path) if parent else None
            if c['files'].get(path) != before: out.append(sha)
            sha = parent
        return out

    @staticmethod
    def _blob(text): return hashlib.sha1(text.encode()).hexdigest()

    def handle(self, route):
        req = route.request
        url = urlparse(req.url)
        path, q = url.path, parse_qs(url.query)
        body = json.loads(req.post_data) if req.post_data else {}
        self.log.append((req.method, path, body))
        ok = lambda data, status=200: route.fulfill(status=status, json=data)
        missing = lambda: route.fulfill(status=404, json={'message': 'Not Found'})
        if path == '/user': return ok({'login': 'zafranzak98'})
        if not path.startswith(self.prefix): return missing()
        p = path[len(self.prefix):]
        if p.startswith('/contents/'):
            file = unquote(p[len('/contents/'):])
            if req.method == 'GET':
                files = self.files(q.get('ref', ['main'])[0])
                if files is None or file not in files: return missing()
                text = files[file]
                return ok({'content': base64.b64encode(text.encode()).decode(), 'sha': self._blob(text), 'path': file})
            branch = body.get('branch', 'main')
            files = dict(self.files(branch))
            current = files.get(file)
            if current is not None and body.get('sha') != self._blob(current): return ok({'message': 'conflict'}, 409)
            if req.method == 'DELETE': files.pop(file, None)
            else: files[file] = base64.b64decode(body['content']).decode()
            self.branches[branch] = self._commit(files, self.branches[branch], body.get('message', ''))
            return ok({'content': {'path': file}})
        if p.startswith('/git/ref/heads/'):
            b = p[len('/git/ref/heads/'):]
            return ok({'object': {'sha': self.branches[b]}}) if b in self.branches else missing()
        if p.startswith('/branches/'):
            b = p[len('/branches/'):]
            return ok({'name': b}) if b in self.branches else missing()
        if p == '/git/refs' and req.method == 'POST':
            self.branches[body['ref'].replace('refs/heads/', '')] = body['sha']
            return ok({'ref': body['ref']}, 201)
        if p.startswith('/git/commits/') and req.method == 'GET':
            sha = p[len('/git/commits/'):]
            return ok({'sha': sha, 'tree': {'sha': 'tree:' + sha}})
        if p == '/git/trees' and req.method == 'POST':
            files = dict(self.commits[body['base_tree'][5:]]['files'])
            for t in body['tree']:
                if 'sha' in t and t['sha'] is None: files.pop(t['path'], None)
                else: files[t['path']] = t['content']
            tid = 'built:' + self._id('tree')
            self.trees[tid] = files
            return ok({'sha': tid}, 201)
        if p == '/git/commits' and req.method == 'POST':
            sha = self._id(body['message'])
            self.commits[sha] = {'files': self.trees[body['tree']], 'parent': body['parents'][0], 'message': body['message'], 'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
            return ok({'sha': sha}, 201)
        if p.startswith('/git/refs/heads/') and req.method == 'PATCH':
            b = p[len('/git/refs/heads/'):]
            if not body.get('force') and self.commits[body['sha']]['parent'] != self.branches[b]: return ok({'message': 'Update is not a fast forward'}, 422)
            self.branches[b] = body['sha']
            return ok({'object': {'sha': body['sha']}})
        if p == '/commits':
            ref, file = q.get('sha', ['main'])[0], q.get('path', [''])[0]
            if ref not in self.branches: return ok([])
            shas = self.history(ref, file)[: int(q.get('per_page', ['30'])[0])]
            return ok([{'sha': s, 'commit': {'message': self.commits[s]['message'], 'author': {'date': self.commits[s]['date']}}} for s in shas])
        return missing()

    def export(self, root, ref='main'):
        """Write the branch's content files over a checkout, to build the website from them."""
        for f, text in self.files(ref).items():
            full = os.path.join(root, f); os.makedirs(os.path.dirname(full), exist_ok=True)
            open(full, 'w', encoding='utf-8').write(text)
        for base, _, names in os.walk(os.path.join(root, 'content')):
            for n in names:
                rel = os.path.relpath(os.path.join(base, n), root).replace(os.sep, '/')
                if rel not in self.files(ref): os.remove(os.path.join(base, n))
