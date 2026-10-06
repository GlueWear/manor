// Test-only stand-in for a Theseus host's Eyre: host login, the moons'
// /theseus/~<moon> login and pages, Theseus' ui/web scries, and a channel
// that takes %theseus-recycle and restores in stages like the real host.
import http from 'node:http';
import crypto from 'node:crypto';

export async function startHost({ship = '~zod', code = 'host-code', moons = {}, snapshots = []} = {}) {
  const state = {
    ship, code, snapshots, pokes: [],
    // moon -> {code, status, paused, recovery}
    moons: Object.fromEntries(Object.entries(moons).map(([m, c]) => [m, {code: c, status: 'healthy', paused: false, recovery: null}])),
    session: crypto.randomBytes(8).toString('hex'),
  };
  const channels = new Map();
  const authed = req => String(req.headers.cookie || '').includes(`urbauth-${ship}=${state.session}`);
  const json = (res, value, status = 200) => { res.writeHead(status, {'content-type': 'application/json'}); res.end(JSON.stringify(value)); };
  const body = req => new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => r(b)); });

  // A restore: registering, then restarting, then running with new keys.
  function restore(moon) {
    const m = state.moons[moon];
    m.recovery = {stage: 'registering', attempts: 0, reason: null};
    m.paused = true;
    setTimeout(() => { m.recovery = {stage: 'restarting', attempts: 0, reason: null}; }, 1200);
    setTimeout(() => { m.recovery = null; m.paused = false; m.code = crypto.randomBytes(6).toString('hex'); }, 2400);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://host');
    const p = url.pathname;
    if (p === '/~/host') return res.end(ship);
    if (p === '/~/login' && req.method === 'POST') {
      const form = new URLSearchParams(await body(req));
      if (form.get('password') !== code) { res.writeHead(400); return res.end('bad code'); }
      res.writeHead(204, {'set-cookie': `urbauth-${ship}=${state.session}; Path=/; Max-Age=604800`});
      return res.end();
    }
    const moonRoute = p.match(/^\/theseus\/(~[a-z-]+)(\/.*)?$/);
    if (moonRoute) {
      const [, moon, rest = '/'] = moonRoute;
      const m = state.moons[moon];
      if (!m) { res.writeHead(404); return res.end('no such moon'); }
      if (rest === '/~/login' && req.method === 'POST') {
        const form = new URLSearchParams(await body(req));
        if (form.get('password') !== m.code || m.recovery) { res.writeHead(400); return res.end('bad code'); }
        res.writeHead(204, {'set-cookie': [`urbauth-${moon}=0vmoon; Path=/; Max-Age=604800`, `urbauth-${ship}=leak; Path=/`]});
        return res.end();
      }
      return json(res, {moon, path: rest + url.search, cookie: req.headers.cookie || ''});
    }
    if (p.startsWith('/~/scry/') || p.startsWith('/~/channel/')) {
      if (!authed(req)) { res.writeHead(403); return res.end(); }
    }
    if (p === '/~/scry/theseus/ui.json') {
      return json(res, {
        host: ship,
        moons: Object.entries(state.moons).map(([s, m]) => ({ship: s, status: m.status, paused: m.paused, recovery: m.recovery})),
        snapshots: state.snapshots,
      });
    }
    const web = p.match(/^\/~\/scry\/theseus\/web\/(~[a-z-]+)\.json$/);
    if (web) {
      const m = state.moons[web[1]];
      if (!m) { res.writeHead(404); return res.end(); }
      return json(res, {ship: web[1], code: m.recovery ? null : m.code, landscape: true});
    }
    const channel = p.match(/^\/~\/channel\/([\w-]+)$/);
    if (channel) {
      const id = channel[1];
      if (req.method === 'PUT') {
        const actions = JSON.parse(await body(req));
        const queue = channels.get(id) || [];
        for (const a of actions) {
          state.pokes.push(a);
          let err = null;
          if (a.mark === 'theseus-recycle') {
            const snap = state.snapshots.find(s => s.path === a.json.path);
            if (!snap || snap.ships.join() !== a.json.who) err = 'theseus-recycle-snapshot-mismatch';
            else restore(a.json.who);
          }
          queue.push(err ? {id: a.id, response: 'poke', err} : {id: a.id, response: 'poke', ok: 'ok'});
        }
        channels.set(id, queue);
        res.writeHead(204);
        return res.end();
      }
      if (req.method === 'GET') {
        res.writeHead(200, {'content-type': 'text/event-stream'});
        let n = 0;
        for (const event of channels.get(id) || []) res.write(`id: ${n++}\ndata: ${JSON.stringify(event)}\n\n`);
        return;   // left open, like Eyre
      }
      if (req.method === 'DELETE') { channels.delete(id); res.writeHead(204); return res.end(); }
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return {state, url: `http://127.0.0.1:${server.address().port}`, close: () => { server.closeAllConnections(); server.close(); }};
}
