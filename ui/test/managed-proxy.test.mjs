import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, request} from 'node:http';
import {createServer as createSecureServer, request as secureRequest} from 'node:https';
import {once} from 'node:events';
import {execFileSync, spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {managedCaddyfile, managedLocalCaddyfile} from '../src/model.mjs';

async function listen(t, server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => {server.closeAllConnections(); server.close();});
  return server.address().port;
}
async function directory(t, beforeRemove = async () => {}) {
  const dir = await mkdtemp(join(tmpdir(), 'manor-proxy-test-'));
  t.after(async () => {await beforeRemove(); await rm(dir, {recursive: true, force: true});});
  return dir;
}
async function proxy(t, ships, eyre, trustFile = null, publicTLS = false) {
  try {execFileSync('caddy', ['version'], {stdio: 'pipe'});}
  catch {t.skip('Caddy is not installed'); return;}
  const reserve = createServer();
  const port = await listen(t, reserve);
  await new Promise(resolve => reserve.close(resolve));
  let child;
  const dir = await directory(t, async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit');
      child.kill('SIGTERM'); await stopped;
    }
  });
  const file = join(dir, 'Caddyfile');
  let config = managedLocalCaddyfile({ship: '~siglup-narwet', eyre, ships, port});
  let ca;
  if (publicTLS) {
    const reserveLocal = createServer(), localPort = await listen(t, reserveLocal);
    await new Promise(resolve => reserveLocal.close(resolve));
    const key = join(dir, 'key.pem'), cert = join(dir, 'cert.pem');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=example.test', '-addext', 'subjectAltName=DNS:*.example.test', '-keyout', key, '-out', cert], {stdio: 'pipe'});
    ca = await readFile(cert);
    config = managedCaddyfile({ship: '~siglup-narwet', eyre, ships, base: 'example.test', httpsPort: port, localPort})
      .replace('admin localhost:2020', 'admin off')
      .replace(/tls \{\n    on_demand\n    issuer acme \{[^}]+\}\n  \}/, `tls ${cert} ${key}`);
  }
  // Trust only this fixture's CA, keeping certificate and hostname checks on.
  if (trustFile) config = config.replaceAll(/(reverse_proxy https:\/\/[a-z0-9.:-]+ \{\n)/g, `$1          transport http {\n            tls_trust_pool file ${trustFile}\n          }\n`);
  await writeFile(file, config.replaceAll('health_interval 10s', 'health_interval 100ms').replaceAll('health_fails 3', 'health_fails 1'));
  child = spawn('caddy', ['run', '--config', file, '--adapter', 'caddyfile'], {env: {...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir}, stdio: ['ignore', 'ignore', 'pipe']});
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Caddy did not start in time')), 5000);
    let output = '';
    child.stderr.on('data', data => {output += data; if (output.includes('serving initial configuration')) {clearTimeout(timer); resolve();}});
    child.on('error', err => {clearTimeout(timer); reject(err);});
    child.on('exit', () => {clearTimeout(timer); reject(new Error(`Test Caddy exited before readiness: ${output}`));});
  });
  const get = (host, path, cookie = '', headers = {}) => new Promise((resolve, reject) => {
    const send = publicTLS ? secureRequest : request;
    const req = send({hostname: '127.0.0.1', servername: host, ca, port, path, headers: {host, cookie, 'x-forwarded-host': 'forged.example', ...headers}}, res => {
      res.resume(); res.on('end', () => resolve({status: res.statusCode, headers: res.headers}));
    });
    req.setTimeout(3000, () => req.destroy(new Error('Local proxy request timed out')));
    req.on('error', reject); req.end();
  });
  get.stream = (host, path, cookie = '') => new Promise((resolve, reject) => {
    const req = request({hostname: '127.0.0.1', port, path, headers: {host, cookie}}, res => {
      res.once('data', data => resolve({status: res.statusCode, headers: res.headers, data: data.toString(), close: () => req.destroy()}));
    });
    req.setTimeout(3000, () => req.destroy(new Error('Streaming proxy request timed out')));
    req.on('error', reject); req.end();
  });
  return get;
}

test('visitor events stream immediately with isolated cookies and cancel upstream on close', {timeout: 15000}, async t => {
  let seen, closed;
  const upstreamClosed = new Promise(resolve => {closed = resolve;});
  const eyre = await listen(t, createServer((req, res) => {
    seen = {path: req.url, cookie: req.headers.cookie};
    res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store'});
    res.write('event: policy\ndata: {"enabled":true}\n\n');
    res.on('close', closed);
  }));
  const port = await listen(t, createServer((req, res) => res.end('~zod')));
  const get = await proxy(t, [{ship: '~zod', port}], eyre);
  if (!get) return;
  const stream = await get.stream('zod.localhost', '/~manor/visit/events?tab=fixture&visit=generation', 'manor-visit=proof; urbauth-~siglup-narwet=host; urbauth-~zod=owner');
  assert.equal(stream.status, 200);
  assert.match(stream.headers['content-type'], /^text\/event-stream/);
  assert.match(stream.data, /event: policy/);
  assert.deepEqual(seen, {path: '/apps/manor/public/managed/visit/~zod/events?tab=fixture&visit=generation', cookie: 'manor-visit=proof'});
  stream.close();
  await Promise.race([upstreamClosed, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('Caddy left the upstream stream open')), 2000);
    timer.unref();
  })]);
});

test('local Caddy routes exact ships and never forwards another ship cookie', {timeout: 20000}, async t => {
  const ship = '~zod', seen = [];
  const eyre = await listen(t, createServer((req, res) => {
    seen.push({to: 'host', path: req.url, cookie: req.headers.cookie, forwarded: req.headers['x-forwarded-host']});
    res.end('host fixture');
  }));
  const port = await listen(t, createServer((req, res) => {
    if (req.url === '/~/host') return res.end(ship);
    if (req.url === '/~/name') return res.end('~guest-comet-fixture');
    seen.push({to: 'ship', path: req.url, cookie: req.headers.cookie});
    res.end('ship fixture');
  }));
  const get = await proxy(t, [{ship, port}], eyre);
  if (!get) return;
  assert.equal((await get('join.localhost', '/assign')).status, 200);
  assert.deepEqual(seen.at(-1), {to: 'host', path: '/apps/manor/public/managed/assign', cookie: undefined, forwarded: 'join.localhost'});
  assert.equal((await get('zod.localhost', '/~manor/enter?ticket=fixture', 'urbauth-~siglup-narwet=secret')).status, 200);
  assert.equal(seen.at(-1).path, `/apps/manor/public/managed/enter/${ship}?ticket=fixture`);
  assert.equal(seen.at(-1).cookie, undefined);
  const cookies = `urbauth-~siglup-narwet=host-fixture; urbauth-${ship}=own-fixture; urbauth-~nec=other-fixture`;
  await get('zod.localhost', '/apps/glurff/', cookies);
  assert.deepEqual(seen.at(-1), {to: 'ship', path: '/apps/glurff/', cookie: `urbauth-${ship}=own-fixture`});
  await get('zod.localhost', '/apps/glurff/', 'urbauth-~siglup-narwet=host-fixture');
  assert.equal(seen.at(-1).cookie, undefined);
  await get('zod.localhost', '/apps/glurff/', 'urbauth-~zod-extra=wrong; not-urbauth-~zod=wrong');
  assert.equal(seen.at(-1).cookie, undefined);
  const visitCookies = `${cookies}; manor-visit=visit-fixture`;
  const shell = await get('zod.localhost', '/apps/glurff/', visitCookies, {'sec-fetch-dest': 'document'});
  assert.equal(shell.headers['cache-control'], 'no-store');
  assert.deepEqual(seen.at(-1), {to: 'host', path: '/apps/manor/public/managed/visit/~zod', cookie: 'manor-visit=visit-fixture', forwarded: 'zod.localhost'});
  await get('zod.localhost', '/apps/glurff/', visitCookies, {'sec-fetch-dest': 'iframe'});
  assert.deepEqual(seen.at(-1), {to: 'ship', path: '/apps/glurff/', cookie: 'urbauth-~zod=own-fixture'});
  await get('zod.localhost', '/~manor/visit/close', visitCookies);
  assert.deepEqual(seen.at(-1), {to: 'host', path: '/apps/manor/public/managed/visit/~zod/close', cookie: 'manor-visit=visit-fixture', forwarded: 'zod.localhost'});
  const count = seen.length;
  for (const path of ['/~/login', '/apps/manor/', '/full/assign', '/managed/assign']) assert.equal((await get('join.localhost', path)).status, 404);
  assert.equal((await get('unknown.localhost', '/')).status, 404);
  assert.equal(seen.length, count);
});

test('public HTTPS routes only registered ships and keeps host credentials private', {timeout: 20000}, async t => {
  const seen = [];
  const eyre = await listen(t, createServer((req, res) => {
    if (req.url === '/~/host') return res.end('~siglup-narwet');
    seen.push({to: 'controller', path: req.url, cookie: req.headers.cookie, authorization: req.headers.authorization, forwarded: req.headers['x-forwarded-host']});
    res.end('controller fixture');
  }));
  const port = await listen(t, createServer((req, res) => {
    if (req.url === '/~/host') return res.end('~zod');
    seen.push({to: 'ship', path: req.url, cookie: req.headers.cookie, authorization: req.headers.authorization});
    res.end('ship fixture');
  }));
  const get = await proxy(t, [{ship: '~zod', port}], eyre, null, true);
  if (!get) return;
  const headers = {authorization: 'Bearer fixture', 'proxy-authorization': 'Basic fixture'};
  assert.equal((await get('join.example.test', '/assign', 'urbauth-~siglup-narwet=host-fixture', headers)).status, 200);
  assert.deepEqual(seen.at(-1), {to: 'controller', path: '/apps/manor/public/managed/assign', cookie: undefined, authorization: undefined, forwarded: 'join.example.test'});
  await get('zod.example.test', '/~manor/enter?ticket=fixture', '', headers);
  assert.equal(seen.at(-1).path, '/apps/manor/public/managed/enter/~zod?ticket=fixture');
  assert.equal(seen.at(-1).authorization, undefined);
  await get('zod.example.test', '/apps/glurff/', 'urbauth-~siglup-narwet=host-fixture; urbauth-~zod=own-fixture; urbauth-~nec=other-fixture', headers);
  assert.deepEqual(seen.at(-1), {to: 'ship', path: '/apps/glurff/', cookie: 'urbauth-~zod=own-fixture', authorization: undefined});
  const count = seen.length;
  for (const path of ['/~/login', '/apps/manor/', '/~/scry/manor/state.json', '/managed/assign']) assert.equal((await get('join.example.test', path)).status, 404);
  for (const host of ['unknown.example.test', 'siglup-narwet.example.test']) assert.equal((await get(host, '/')).status, 404);
  assert.equal(seen.length, count);
});

test('health checks reject the wrong exact identity even when /~/name matches', {timeout: 20000}, async t => {
  let visits = 0;
  const eyre = await listen(t, createServer((req, res) => res.end('controller')));
  const port = await listen(t, createServer((req, res) => {
    if (req.url === '/~/host') return res.end('prefix~zodsuffix');
    if (req.url === '/~/name') return res.end('~zod');
    visits++; res.end('wrong ship');
  }));
  const get = await proxy(t, [{ship: '~zod', port}], eyre);
  if (!get) return;
  await new Promise(resolve => setTimeout(resolve, 250));
  for (const cookie of ['', 'urbauth-~zod=secret']) assert.equal((await get('zod.localhost', '/apps/glurff/', cookie)).status, 503);
  assert.equal(visits, 0);
});

test('HTTPS endpoints use normal certificate trust and hostname verification', {timeout: 30000}, async t => {
  const dir = await directory(t), key = join(dir, 'key.pem'), cert = join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-addext', 'basicConstraints=critical,CA:TRUE', '-keyout', key, '-out', cert], {stdio: 'pipe'});
  const seen = [];
  const port = await listen(t, createSecureServer({key: await readFile(key), cert: await readFile(cert)}, (req, res) => {
    if (req.url === '/~/host') return res.end('~zod');
    seen.push({cookie: req.headers.cookie, host: req.headers.host}); res.end('secure ship');
  }));
  const eyre = await listen(t, createServer((req, res) => res.end('controller')));
  const endpoint = {host: '127.0.0.1', port, secure: true};
  await t.test('untrusted certificate is refused', async t => {
    const get = await proxy(t, [{ship: '~zod', endpoint}], eyre);
    if (!get) return;
    assert.equal((await get('zod.localhost', '/')).status, 503);
    assert.equal(seen.length, 0);
  });
  await t.test('trusted certificate is accepted with cookie isolation', async t => {
    const get = await proxy(t, [{ship: '~zod', endpoint}], eyre, cert);
    if (!get) return;
    assert.equal((await get('zod.localhost', '/', 'urbauth-~zod=own; urbauth-~nec=other')).status, 200);
    assert.deepEqual(seen.at(-1), {cookie: 'urbauth-~zod=own', host: `127.0.0.1:${port}`});
  });
  await t.test('trust does not bypass hostname verification', async t => {
    const get = await proxy(t, [{ship: '~zod', endpoint: {...endpoint, host: 'localhost'}}], eyre, cert);
    if (!get) return;
    const before = seen.length;
    assert.equal((await get('zod.localhost', '/')).status, 503);
    assert.equal(seen.length, before);
  });
});
