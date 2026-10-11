// Test-only stand-in for the host's Eyre: %manor's state scry and admin
// pokes, and Theseus's ui.json. Mirrors app/manor.hoon's checks.
import {createServer} from 'node:http';

const host = '~siglup-narwet';
const moon = name => `~${name}-siglup-narwet`;
const [A, B, C, D, E] = ['ritdex-sorled', 'lonteb-tarhus', 'fopsep-litruc', 'dozpen-dozpen', 'ribmut-mogwyn'].map(moon);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const ready = ship => ({ship, status: 'healthy', paused: false, recovery: null, desks: [{desk: 'base', stage: 'running'}, {desk: 'glurff', stage: 'running'}]});

let manor, theseus, signedOut, pokes, profiles;
// Names and pictures, as Theseus's profiles.json gives them: ~ritdex-sorled
// is named, ~fopsep-litruc doesn't run Noltbook.
const profileRow = (ship, noltbook = true, name = null, avatar = null) => ({ship, noltbook, name, avatar});
const reset = () => {
  signedOut = false; pokes = [];
  const now = Date.now();
  manor = {
    fleet: {name: 'hosting', snapshot: '/hosting-reset'},
    settings: {base: '', landing: '/apps/landscape/'},
    pool: [A, B, C].map(ship => ({ship, snapshot: '/hosting-reset', claim: null})),
    log: [{at: now - 60_000, text: 'Connected fleet hosting: 3 moons.'}],
    front: null, host, eyre: 8083,
  };
  profiles = new Map([[A, profileRow(A, true, 'Ada')], [B, profileRow(B)], [C, profileRow(C, false)], [D, profileRow(D)], [E, profileRow(E)]]);
  manor.pool[0].claim = {at: now - 600_000, expires: null, entered: now - 590_000};
  manor.pool[1].claim = {at: now - 30_000, expires: now + 90_000, entered: null};
  const snap = (set, ship, compatible = true) => ({path: `${set}/${ship}`, set, ships: [ship], compatible, created: '~2026.10.10..12.0.0'});
  theseus = {
    host, version: 3,
    moons: [ready(A), ready(B), {...ready(C), desks: [{desk: 'base', stage: 'running'}, {desk: 'glurff', stage: 'catching-up'}]}, ready(D), ready(E)],
    fleets: [{name: 'hosting', ships: [A, B, C], desks: [], created: 1}, {name: 'other', ships: [D, E], desks: [], created: 2}, {name: 'lonely', ships: [D], desks: [], created: 3}],
    snapshots: [...[A, B, C].map(s => snap('/hosting-reset', s)), ...[D, E].map(s => snap('/other-clean', s)), snap('/half', D)],
    caches: [],
  };
};
reset();

// Mirrors the "something changed" facts: %manor's /state, %theseus's /ui.
const signal = key => {for (const ch of channels.values()) if (ch[key]) send(ch, {id: ch[key], response: 'diff', json: true});};
// Mirrors %theseus's /profiles facts: one row per change, to every watcher.
const pushProfile = ship => {const row = profiles.get(ship); if (row) for (const ch of channels.values()) if (ch.profiles) send(ch, {id: ch.profiles, response: 'diff', json: row});};
const log = text => {manor.log = [{at: Date.now(), text}, ...manor.log].slice(0, 50);};
const names = ships => ships.length > 3 ? `${ships.length} moons` : ships.join(', ');
// %theseus restores a moon: it is "registering", then running again.
const restore = ship => {
  const m = theseus.moons.find(row => row.ship === ship);
  if (!m) return;
  m.recovery = {stage: 'registering', attempts: 0, reason: null};
  signal('ui');
  setTimeout(() => {m.recovery = null; signal('ui');}, 1500);
};

// %theseus's profile command, as the Theseus console sends it.
function applyProfile(value) {
  const p = profiles.get(value.who);
  pokes.push({kind: 'profile', value: {...value, upload: value.upload ? `${value.upload.length} base64 chars` : undefined}});
  if (!p) return 'theseus-profile-missing';
  if ('upload' in value) {
    const bytes = Buffer.from(String(value.upload), 'base64');
    if (!p.noltbook || 'avatar' in value || !bytes.length || bytes.length > 51200 || bytes[0] !== 0xff) return 'theseus-picture-refused';
    p.avatar = {type: 'urbit', url: `0v${pokes.length}`};
  }
  if ('name' in value) p.name = value.name || null;
  if (p.noltbook && 'avatar' in value) p.avatar = value.avatar === null ? null : {type: 'external', url: value.avatar};
  pushProfile(value.who);
  return null;
}

// Returns an error to reject the poke, as %manor's crashes would.
function apply(action) {
  const [kind, value] = Object.entries(action)[0];
  pokes.push({kind, value});
  const inPool = ships => (ships || []).filter(s => manor.pool.some(r => r.ship === s));
  if (kind === 'connect') {
    const fleet = theseus.fleets.find(f => f.name === value.fleet);
    if (!fleet || !fleet.ships.length) return 'manor-no-such-fleet';
    const covered = new Set(theseus.snapshots.filter(s => s.path === value.snapshot || s.set === value.snapshot).flatMap(s => s.ships));
    if (fleet.ships.some(s => !covered.has(s))) return 'manor-snapshot-misses';
    const old = new Map(manor.pool.map(r => [r.ship, r.claim]));
    manor.pool = fleet.ships.map(ship => ({ship, snapshot: value.snapshot, claim: old.get(ship) || null}));
    manor.fleet = {name: fleet.name, snapshot: value.snapshot};
    log(`Connected fleet ${fleet.name}: ${fleet.ships.length} moons.`);
  } else if (kind === 'reset') {
    const hers = inPool(value.ships);
    hers.forEach(ship => {manor.pool.find(r => r.ship === ship).claim = null; restore(ship);});
    if (hers.length) log(`Resetting ${names(hers)}.`);
  } else if (kind === 'release') {
    const hers = inPool(value.ships);
    hers.forEach(ship => {manor.pool.find(r => r.ship === ship).claim = null;});
    if (hers.length) log(`Freed ${names(hers)} as they are.`);
  } else if (kind === 'remove') {
    const hers = inPool(value.ships);
    manor.pool = manor.pool.filter(r => !hers.includes(r.ship));
    if (!manor.pool.length) manor.fleet = null;
    if (hers.length) log(`Removed ${names(hers)} from the pool.`);
  } else if (kind === 'settings') {
    if (!/^[a-z0-9.-]{0,200}$/.test(value.base) || !/^\/[\x21-\x7e]{0,199}$/.test(value.landing)) return 'bad settings';
    manor.settings = {base: value.base, landing: value.landing};
    log('Settings saved.');
  } else return 'bad action';
  return null;
}

let id = 0;
const channels = new Map();
const send = (channel, event) => {
  const text = `id: ${++id}\ndata: ${JSON.stringify(event)}\n\n`;
  if (channel.response) channel.response.write(text); else channel.pending.push(text);
};
const json = (res, value) => {res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value));};

createServer(async (req, res) => {
  const url = req.url;
  if (url === '/health') return res.end('ok');
  if (url === '/reset') {reset(); return res.end('ok');}
  if (url === '/sign-out') {signedOut = true; return res.end('ok');}
  // a visitor pulled the lever (as %manor's /assign would)
  if (url.startsWith('/visitor/')) {
    const row = manor.pool.find(r => r.ship === decodeURIComponent(url.slice(9)));
    if (row) {row.claim = {at: Date.now(), expires: Date.now() + 120_000, entered: null}; log(`Gave ${row.ship} to a visitor.`); signal('state');}
    return res.end('ok');
  }
  if (url === '/pokes') return json(res, pokes);
  // a change made elsewhere, e.g. in the moon's own Noltbook
  const change = /^\/profile-change\?ship=(~[a-z-]+)&name=([^&]*)$/.exec(url);
  if (change) {const p = profiles.get(change[1]); if (p) {p.name = decodeURIComponent(change[2]) || null; pushProfile(change[1]);} return res.end('ok');}
  if (url === '/apps/manor/icon.png') {res.setHeader('content-type', 'image/png'); return res.end(png);}
  if (url.startsWith('/~/scry/') && signedOut) {res.statusCode = 403; return res.end();}
  if (url === '/~/scry/manor/state.json') return json(res, manor);
  if (url === '/~/scry/theseus/ui.json') return json(res, theseus);
  if (url === '/~/scry/theseus/profiles.json') return json(res, {host: profileRow(host, false), moons: [...profiles.values()]});
  if (url === '/~/scry/theseus-ui/gateway.json') return json(res, {mode: 'auto', port: null, template: null, live: {port: 5184, upstream: 8083, at: '~2026.10.11..12.0.0'}, eyre: 8083, url: 'http://{moon}.localhost:5184', status: 'ok'});
  if (url.startsWith('/apps/noltbook/user-avatar/')) {res.setHeader('content-type', 'image/png'); return res.end(png);}
  if (!url.startsWith('/~/channel/')) {res.statusCode = 404; return res.end();}
  const channel = channels.get(url) || {pending: [], response: null};
  channels.set(url, channel);
  if (req.method === 'GET') {
    res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive'});
    res.flushHeaders(); channel.response = res;
    channel.pending.splice(0).forEach(text => res.write(text));
    const timer = setInterval(() => res.write(': heartbeat\n\n'), 1000);
    req.on('close', () => {clearInterval(timer); channel.response = null;});
    return;
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  for (const action of JSON.parse(body || '[]')) {
    if (action.action === 'delete') {channel.response?.end(); channels.delete(url); continue;}
    if (action.action === 'subscribe') {
      const key = {'theseus/profiles': 'profiles', 'theseus/ui': 'ui', 'manor/state': 'state'}[`${action.app}${action.path}`];
      if (key) channel[key] = action.id;
      send(channel, {id: action.id, response: 'subscribe', ok: 'ok'}); continue;
    }
    if (action.action !== 'poke') continue;
    const before = JSON.stringify(manor);
    const err = action.app === 'manor' && action.mark === 'manor-action' ? apply(action.json)
      : action.app === 'theseus' && action.mark === 'theseus-ui' && action.json.profile ? applyProfile(action.json.profile)
      : 'unknown poke';
    send(channel, err ? {id: action.id, response: 'poke', err} : {id: action.id, response: 'poke', ok: 'ok'});
    if (JSON.stringify(manor) !== before) signal('state');
  }
  res.statusCode = 204; res.end();
}).listen(8095, '127.0.0.1');
