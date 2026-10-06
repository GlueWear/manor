// End-to-end tests of the broker and pool.mjs against a mock Theseus host.
//   node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startHost} from './mock-host.mjs';

const HOME = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const A = '~dozpen-dozpen-siglup-narwet';
const B = '~ribmut-mogwyn-siglup-narwet';
const BASE = 'manor.test';

const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => r(port)); }); });

// One test world: a mock host, a state directory and settings pointing at both.
async function world({pool = {}, claims = {}, snapshots} = {}) {
  const host = await startHost({ship: '~siglup-narwet', code: 'host-code', moons: {[A]: 'code-a', [B]: 'code-b'},
    snapshots: snapshots || [{path: '/clean-a', ships: [A], compatible: true}, {path: '/clean-b', ships: [B], compatible: true}]});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manor-'));
  const env = {...process.env, MANOR_HOST_URL: host.url, MANOR_BASE: BASE, MANOR_LANDING: '/apps/noltbook/',
    MANOR_POOL_FILE: path.join(dir, 'pool.json'), MANOR_CLAIMS_FILE: path.join(dir, 'claims.json'), MANOR_HOST_CODE: 'host-code'};
  fs.writeFileSync(env.MANOR_POOL_FILE, JSON.stringify(pool));
  fs.writeFileSync(env.MANOR_CLAIMS_FILE, JSON.stringify(claims));
  const read = file => JSON.parse(fs.readFileSync(env[file], 'utf8'));
  const pool$ = () => read('MANOR_POOL_FILE');
  const claims$ = () => read('MANOR_CLAIMS_FILE');
  const run = async (...args) => {
    try { const {stdout, stderr} = await promisify(execFile)('node', [path.join(HOME, 'pool.mjs'), ...args], {env}); return {code: 0, out: stdout + stderr}; }
    catch (e) { return {code: e.code, out: (e.stdout || '') + (e.stderr || '')}; }
  };
  return {host, dir, env, pool$, claims$, run, done: () => { host.close(); fs.rmSync(dir, {recursive: true, force: true}); }};
}

async function startBroker(env) {
  const port = await freePort();
  const child = spawn('node', [path.join(HOME, 'broker.mjs')], {env: {...env, MANOR_BROKER_PORT: String(port)}, stdio: 'pipe'});
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 50; i++) {
    try { if ((await get(port, '/health')).status === 200) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return {port, log: () => log, stop: () => child.kill()};
}

// A request to the broker as Caddy would send it: the visitor's Host, and
// how they connected.
function get(port, pathname, {host = 'localhost', cookie, proto} = {}) {
  return new Promise((resolve, reject) => {
    const headers = {host};
    if (cookie) headers.cookie = cookie;
    if (proto) headers['x-forwarded-proto'] = proto;
    http.get({host: '127.0.0.1', port, path: pathname, headers}, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body}));
    }).on('error', reject);
  });
}

test('the lever hands out each pool moon once, logged in, and then runs out', async () => {
  const w = await world({pool: {[A]: {code: 'code-a', snapshot: '/clean-a'}, [B]: {code: 'code-b', snapshot: '/clean-b'}}});
  const broker = await startBroker(w.env);
  try {
    const first = await get(broker.port, '/assign', {host: `join.${BASE}`, proto: 'https'});
    assert.equal(first.status, 302);
    const to = new URL(first.headers.location);
    assert.equal(to.protocol, 'https:');
    assert.equal(to.hostname, `${A.slice(1)}.${BASE}`);
    const ticket = to.searchParams.get('ticket');
    assert.ok(ticket && ticket.length > 20);
    assert.ok(!JSON.stringify(w.claims$()).includes(ticket), 'only a hash of the ticket is stored');

    // Without the ticket, a moon handed to someone else stays closed.
    const guessed = await get(broker.port, '/broker', {host: to.host});
    assert.equal(guessed.status, 403);

    const login = await get(broker.port, `/broker?ticket=${ticket}`, {host: to.host});
    assert.equal(login.status, 303);
    assert.equal(login.headers.location, '/apps/noltbook/');
    const cookies = login.headers['set-cookie'];
    assert.equal(cookies.length, 1, 'only the moon\'s cookie is passed on');
    assert.match(cookies[0], new RegExp(`^urbauth-${A}=`));
    assert.ok(w.claims$()[A].entered);

    // The ticket works once; a returning visitor with the cookie carries on.
    assert.equal((await get(broker.port, `/broker?ticket=${ticket}`, {host: to.host})).status, 403);
    const back = await get(broker.port, '/broker', {host: to.host, cookie: `urbauth-${A}=0vmoon`});
    assert.equal(back.status, 303);
    assert.equal(back.headers.location, '/apps/noltbook/');

    const second = await get(broker.port, '/assign', {host: `join.${BASE}`, proto: 'https'});
    assert.equal(new URL(second.headers.location).hostname, `${B.slice(1)}.${BASE}`);
    const none = await get(broker.port, '/assign', {host: `join.${BASE}`});
    assert.equal(none.status, 503);
    assert.match(none.body, /All moons are taken/);
    assert.ok(!broker.log().includes('code-a') && !broker.log().includes(ticket), 'codes and tickets stay out of the log');
  } finally { broker.stop(); w.done(); }
});

test('a local visit stays on http and on the local port', async () => {
  const w = await world({pool: {[A]: {code: 'code-a'}}});
  const broker = await startBroker(w.env);
  try {
    const res = await get(broker.port, '/assign', {host: 'join.localhost:8090', proto: 'http'});
    const to = new URL(res.headers.location);
    assert.equal(`${to.protocol}//${to.host}`, `http://${A.slice(1)}.localhost:8090`);
    assert.equal((await get(broker.port, '/assign', {host: `${A.slice(1)}.localhost:8090`})).status, 404, 'only the join host assigns');
  } finally { broker.stop(); w.done(); }
});

test('a link nobody used frees its moon after it expires', async () => {
  const w = await world({pool: {[A]: {code: 'code-a'}}, claims: {[A]: {at: 'x', ticket: 'old', expires: Date.now() - 1000}}});
  const broker = await startBroker(w.env);
  try {
    const res = await get(broker.port, '/assign', {host: `join.${BASE}`});
    assert.equal(res.status, 302);
    assert.equal(new URL(res.headers.location).hostname, `${A.slice(1)}.${BASE}`);
  } finally { broker.stop(); w.done(); }
});

test('a moon with an out-of-date code gets a retryable error, not a broken login', async () => {
  const w = await world({pool: {[A]: {code: 'stale'}}});
  const broker = await startBroker(w.env);
  try {
    const to = new URL((await get(broker.port, '/assign', {host: `join.${BASE}`})).headers.location);
    const res = await get(broker.port, to.pathname + to.search, {host: to.host});
    assert.equal(res.status, 502);
    assert.equal(res.headers['set-cookie'], undefined);
    assert.ok(w.claims$()[A].ticket, 'the ticket survives for a retry');
    assert.match(broker.log(), /node pool\.mjs refresh/);
  } finally { broker.stop(); w.done(); }
});

test('certificates only for the join host and pool moons', async () => {
  const w = await world({pool: {[A]: {code: 'code-a'}}});
  const broker = await startBroker(w.env);
  try {
    const ask = d => get(broker.port, `/tls-ask?domain=${d}`).then(r => r.status);
    assert.equal(await ask(`join.${BASE}`), 200);
    assert.equal(await ask(`${A.slice(1)}.${BASE}`), 200);
    assert.equal(await ask(`${B.slice(1)}.${BASE}`), 403, 'a host moon outside the pool');
    assert.equal(await ask(`${A.slice(1)}.example.com`), 403);
    assert.equal(await ask(`x.${A.slice(1)}.${BASE}`), 403);
    assert.equal(await ask(''), 403);
  } finally { broker.stop(); w.done(); }
});

test('pool add reads codes from the host into a private file, and list never prints them', async () => {
  const w = await world();
  try {
    const added = await w.run('add', A, '--snapshot', '/clean-a');
    assert.equal(added.code, 0, added.out);
    assert.equal((await w.run('add', B)).code, 0);
    assert.deepEqual(w.pool$(), {[A]: {code: 'code-a', snapshot: '/clean-a'}, [B]: {code: 'code-b', snapshot: null}});
    assert.equal(fs.statSync(w.env.MANOR_POOL_FILE).mode & 0o777, 0o600);
    const list = await w.run('list');
    assert.match(list.out, new RegExp(`${A}\\s+free\\s+/clean-a\\s+code saved`));
    assert.ok(!/code-a|code-b/.test(list.out));
    assert.notEqual((await w.run('add', '~sampel-palnet')).code, 0, 'a moon the host does not have');
    const wrong = await w.run('add', B, '--snapshot', '/clean-a');
    assert.match(wrong.out, /holds ~dozpen-dozpen-siglup-narwet, not just ~ribmut-mogwyn-siglup-narwet/);
  } finally { w.done(); }
});

test('recycle restores, waits for the moon to run, saves its new code and frees it', async () => {
  const w = await world({pool: {[A]: {code: 'code-a', snapshot: '/clean-a'}}, claims: {[A]: {at: 'x', entered: 'y'}}});
  try {
    const dry = await w.run('recycle', '--claimed');
    assert.match(dry.out, /would recycle ~dozpen-dozpen-siglup-narwet to \/clean-a/);
    assert.equal(w.host.state.pokes.length, 0, 'a dry run sends nothing');

    const res = await w.run('recycle', '--claimed', '--execute');
    assert.equal(res.code, 0, res.out);
    assert.deepEqual(w.host.state.pokes.map(p => [p.ship, p.app, p.mark, p.json]),
      [['siglup-narwet', 'theseus', 'theseus-recycle', {who: A, path: '/clean-a'}]]);
    assert.equal(w.pool$()[A].code, w.host.state.moons[A].code);
    assert.notEqual(w.pool$()[A].code, 'code-a');
    assert.deepEqual(w.claims$(), {});
  } finally { w.done(); }
});

test('a failed recycle holds the moon back with the reason', async () => {
  const w = await world({pool: {[A]: {code: 'code-a', snapshot: '/both'}}, claims: {[A]: {at: 'x', entered: 'y'}},
    snapshots: [{path: '/both', ships: [A, B], compatible: true}]});
  try {
    const res = await w.run('recycle', A, '--execute');
    assert.notEqual(res.code, 0);
    assert.equal(w.claims$()[A].status, 'recycle-error');
    assert.match(w.claims$()[A].error, /holds .* not just/);
    assert.match((await w.run('list')).out, /recycle-error/);
    await w.run('release', A);
    assert.deepEqual(w.claims$(), {});
  } finally { w.done(); }
});
