import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';

const html = await readFile(new URL('../../desk/web/visit.html', import.meta.url), 'utf8');

export async function createVisitorHost() {
  const state = {opened: [], closed: [], pages: [], activity: [], heartbeats: [], reads: 0, refused: false, minutes: 0, now: Date.now(), expiresAt: null, revision: 0, ending: false, clients: new Set()};
  state.policy = () => ({enabled: state.minutes > 0, minutes: state.minutes, warningSeconds: 60, now: state.now, expiresAt: state.expiresAt, revision: state.revision});
  state.broadcast = (name = 'policy', value = state.policy()) => {
    for (const res of state.clients) res.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
  };
  state.configure = minutes => {
    state.minutes = minutes;
    state.expiresAt = minutes ? state.now + minutes * 60000 : null;
    state.revision++;
    state.broadcast();
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fixture.localhost');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname.startsWith('/~manor/visit/')) {
      const op = url.pathname.split('/').at(-1);
      let body = ''; for await (const chunk of req) body += chunk;
      const tab = body.split(':')[0];
      if (op === 'close') {state.closed.push(tab); res.writeHead(204); res.end(); return;}
      if (state.ending || (state.minutes && state.expiresAt !== null && state.now >= state.expiresAt)) {
        state.ending = true; state.broadcast('ending', null); res.writeHead(403); res.end(); return;
      }
      if (op === 'open' && state.refused) {res.writeHead(403); res.end(); return;}
      if (op === 'open' && req.headers['x-manor-heartbeat'] === '1') {
        state.heartbeats.push(tab); res.writeHead(204); res.end(); return;
      }
      if (op === 'events') {
        res.writeHead(200, {'Content-Type': 'text/event-stream'});
        res.write(`event: policy\ndata: ${JSON.stringify(state.policy())}\n\n`);
        state.clients.add(res); res.on('close', () => state.clients.delete(res)); return;
      }
      if (op === 'open' || op === 'activity') {
        (op === 'open' ? state.opened : state.activity).push(tab);
        if (state.minutes) state.expiresAt = state.now + state.minutes * 60000;
        state.revision++; state.broadcast();
      } else if (op === 'state') state.reads++;
      else {res.writeHead(404); res.end(); return;}
      res.writeHead(200, {'Content-Type': 'application/json'}); res.end(JSON.stringify(state.policy()));
    } else if (url.pathname.startsWith('/apps/')) {
      res.setHeader('Content-Type', 'text/html');
      if (req.headers['sec-fetch-dest'] === 'iframe') {
        state.pages.push(url.pathname);
        res.end('<!doctype html><title>Visitor app</title><h1>App ready</h1><input aria-label="Message"><button>App action</button><a href="/apps/next/">Other app</a><a href="/apps/next/" target="_blank">New tab</a>');
      } else {
        res.setHeader('Set-Cookie', 'manor-visit-id=fixture-generation; Path=/; SameSite=Lax'); res.end(html);
      }
    } else {res.writeHead(404); res.end();}
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  state.server = server;
  state.origin = `http://127.0.0.1:${server.address().port}`;
  state.close = async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));};
  return state;
}
