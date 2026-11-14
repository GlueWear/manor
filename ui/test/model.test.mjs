import test from 'node:test';
import assert from 'node:assert/strict';
import {appConfigProblem, baseProblem, daMs, externalAvatarProblem, fullLocalCaddyfile, managedCaddyfile, managedEndpoint, managedLocalCaddyfile, managedRemovalKind, managedShipStatus, landingProblem, moonStatus, normalizeShip, publicLink, resetProgress, shipProblem, shortMoon, snapshotChoices, usedMoons, validateState} from '../src/model.mjs';

const healthy = {status: 'healthy', paused: false, recovery: null, desks: [{desk: 'base', stage: 'running'}]};

test('claimed and pending ships use local forget, independent of cached online state', () => {
  for (const online of [true, false]) {
    assert.equal(managedRemovalKind({online, claim: null, pending: null}), 'ship-remove');
    assert.equal(managedRemovalKind({online, claim: {entered: 1}, pending: null}), 'ship-forget');
    for (const pending of ['session', 'revoke', 'profile']) assert.equal(managedRemovalKind({online, claim: null, pending}), 'ship-forget');
  }
});

test('connection requests retain epoch dates and generic identities without requiring new fields on old state', () => {
  const state = {pool: [], log: [], settings: {base: '', landing: '/apps/landscape/'}};
  assert.equal(validateState(state), state);
  const pairRequests = ['~zod', '~siglup', '~siglup-narwet', '~pilfep-sicted-mignes-magtel', '~doznec-salfun-naptul-habrys--disseb-lissur-dopmet-padrum'].map(ship => ({ship, at: 1794657600000}));
  assert.deepEqual(validateState({...state, pairRequests}).pairRequests, pairRequests);
  for (const pairRequests of [{}, [null], [{ship: '~zod', at: '1794657600000'}], [{ship: '~zod', at: Infinity}], [{ship: '~zod', at: 9e15}], [{ship: '~zod\nrespond', at: 1}]]) assert.throws(() => validateState({...state, pairRequests}), /connection requests/);
});

test('managed ships stay unavailable while working, reserved or after an uncertain outcome', () => {
  const row = {online: true, ready: true, blocked: false, pending: null, fault: null, claim: null};
  assert.equal(managedShipStatus(row).key, 'free');
  assert.equal(managedShipStatus({...row, pending: 'revoke', claim: {entered: 1}}).label, 'unlocking');
  assert.equal(managedShipStatus({...row, pending: 'session'}).label, 'logging in');
  assert.equal(managedShipStatus({...row, pending: 'profile'}).label, 'saving profile');
  assert.equal(managedShipStatus({...row, blocked: true}).key, 'blocked');
  assert.equal(managedShipStatus({...row, fault: 'Unknown outcome'}).key, 'failed');
  assert.equal(managedShipStatus({...row, fault: 'Profile update failed'}).label, 'needs attention');
  assert.equal(managedShipStatus({...row, fault: 'Unknown outcome', blocked: true}).label, 'unlock needed');
  assert.equal(managedShipStatus({...row, fault: 'Profile update failed', claim: {entered: 1}}).label, 'needs attention');
  assert.equal(managedShipStatus({...row, online: false}).key, 'offline');
  assert.equal(managedShipStatus({...row, claim: {entered: 1}}).key, 'in-use');
  assert.equal(managedShipStatus({...row, claim: {expires: 1}}).key, 'link-sent', 'no automatic release when a claim ages');
});

test('managed Caddyfile is loopback-only, pins identity and strips other cookies', async () => {
  const options = {ship: '~siglup-narwet', eyre: 8083, ships: [{ship: '~pilfep-sicted-mignes-magtel', port: 8101}]};
  const text = managedLocalCaddyfile(options);
  assert.equal(fullLocalCaddyfile({...options, moons: options.ships}), text);
  assert.match(text, /admin off/);
  assert.match(text, /bind 127\.0\.0\.1/);
  assert.match(text, /reverse_proxy 127\.0\.0\.1:8101/);
  assert.match(text, /health_uri \/~\/host/);
  assert.doesNotMatch(text, /health_uri \/~\/name/);
  assert.match(text, /public\/managed\/assign/);
  assert.match(text, /public\/managed\/enter\/~pilfep-sicted-mignes-magtel/);
  assert.match(text, /header_up -Cookie/);
  assert.match(text, /header_up Cookie \{re\.own0\.1\}/);
  assert.doesNotMatch(text, /on_demand|https:\/\/|\/theseus\//);
  assert.throws(() => managedLocalCaddyfile({...options, ships: [{...options.ships[0], port: 8083}]}), /unique/);
  assert.throws(() => managedLocalCaddyfile({...options, ships: [{...options.ships[0], port: 0}]}), /port/);
  assert.throws(() => managedLocalCaddyfile({...options, ships: [{...options.ships[0], ship: '~bad\nhandle'}]}), /identity/);
  const {execFileSync} = await import('node:child_process');
  try {execFileSync('caddy', ['version'], {stdio: 'pipe'});} catch {return;}
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manor-managed-caddy-'));
  const file = path.join(dir, 'Caddyfile');
  fs.writeFileSync(file, text);
  try {execFileSync('caddy', ['validate', '--config', file, '--adapter', 'caddyfile'], {stdio: 'pipe'});}
  finally {fs.rmSync(dir, {recursive: true, force: true});}
});

test('ship input is broadly structural ASCII, not phonetic or moon-only', () => {
  for (const ship of ['~zod', '~siglup', '~siglup-narwet', '~pilfep-sicted-mignes-magtel', '~doznec-salfun-naptul-habrys--disseb-lissur-dopmet-padrum', '~abcdef-ghijkl']) assert.equal(shipProblem(ship), null, ship);
  for (const ship of ['zod', '~', '~ZOD', '~zod\nhandle', '~zod;foo', '~zod/../../', '~zód', '~zod---zod', '~zod.', '~{env.HOME}']) assert.ok(shipProblem(ship), ship);
  assert.equal(normalizeShip(' zod '), '~zod');
});

test('public managed Caddyfile uses exact registered hosts, safe logging and a local admin', async () => {
  const options = {ship: '~siglup-narwet', eyre: 8083, ships: [{ship: '~zod', port: 8101}], base: 'example.test', httpsPort: 9443, localPort: 8090, admin: '127.0.0.1:2020'};
  const text = managedCaddyfile(options);
  assert.match(text, /https_port 9443/);
  assert.match(text, /host join\.example\.test/);
  assert.match(text, /host zod\.example\.test/);
  assert.match(text, /strict_sni_host on/);
  assert.match(text, /ask http:\/\/127\.0\.0\.1:8083\/apps\/manor\/public\/tls-ask/);
  assert.match(text, /request>uri delete/);
  assert.match(text, /request>headers delete/);
  assert.match(text, /resp_headers delete/);
  assert.match(text, /header_up -Authorization/);
  assert.doesNotMatch(text, /\/theseus\/|insecure_skip_verify/);
  for (const admin of ['0.0.0.0:2020', ':2020', 'localhost:9443', 'localhost:8090']) assert.throws(() => managedCaddyfile({...options, admin}), /admin/);
  for (const port of [8083, 9443, 8090, 2020]) assert.throws(() => managedCaddyfile({...options, ships: [{ship: '~zod', port}]}), /unique effective endpoint/);
  assert.throws(() => managedCaddyfile({...options, eyre: 2020}), /Eyre port/);
  assert.throws(() => managedCaddyfile({...options, ships: []}), /No managed ships/);
  assert.throws(() => managedCaddyfile({...options, base: ''}), /public address/);
  const {execFileSync} = await import('node:child_process');
  try {execFileSync('caddy', ['version'], {stdio: 'pipe'});} catch {return;}
  const config = JSON.parse(execFileSync('caddy', ['adapt', '--adapter', 'caddyfile', '--config', '/dev/stdin'], {input: text, stdio: ['pipe', 'pipe', 'pipe']}));
  assert.deepEqual(config.admin, {listen: '127.0.0.1:2020'});
  assert.ok(Object.values(config.apps.http.servers).some(server => server.strict_sni_host === true));
});

test('managed endpoints require safe host literals and verified remote HTTPS', () => {
  assert.deepEqual(managedEndpoint({port: 8101, endpoint: null}), {host: '127.0.0.1', port: 8101, secure: false, key: '127.0.0.1:8101'});
  for (const host of ['localhost', '127.0.0.1']) assert.equal(managedEndpoint({endpoint: {host, port: 80, secure: false}}).key, '127.0.0.1:80');
  for (const host of ['ship.example', '192.0.2.1']) assert.equal(managedEndpoint({endpoint: {host, port: 443, secure: true}}).host, host);
  assert.throws(() => managedEndpoint({endpoint: {host: 'ship.example', port: 80, secure: false}}), /require HTTPS/);
  for (const host of ['https://ship.example', 'ship.example/path', 'a:443', '[::1]', 'ship.example\nrespond hacked', '{env.HOST}', 'host"', 'a..b', '-a.example', 'a-.example', 'a.'.repeat(130), '127.1', '127.000.0.1', '256.1.1.1', '2130706433', 'a.example.']) assert.throws(() => managedEndpoint({endpoint: {host, port: 443, secure: true}}), /hostname/, host);
  for (const port of [0, -1, 65536, 443.5, '443', NaN]) assert.throws(() => managedEndpoint({endpoint: {host: 'ship.example', port, secure: true}}), /port/);
  assert.throws(() => managedEndpoint({endpoint: {host: 'ship.example', port: 443, secure: 'true'}}));
});

test('managed generator supports all ship sizes, explicit endpoints and rejects effective duplicates', async () => {
  const options = {ship: '~siglup-narwet', eyre: 8083, ships: [
    {ship: '~zod', port: 8101},
    {ship: '~siglup', port: 8101, endpoint: {host: 'Ship.Example', port: 443, secure: true}},
    {ship: '~doznec-salfun-naptul-habrys--disseb-lissur-dopmet-padrum', endpoint: {host: 'localhost', port: 8102, secure: false}},
  ]};
  const text = managedLocalCaddyfile(options);
  assert.match(text, /reverse_proxy https:\/\/ship.example:443/);
  assert.match(text, /header_up Host ship.example:443/);
  assert.match(text, /health_body "\^~zod\$"/);
  assert.match(text, /host doznec-salfun-naptul-habrys--disseb-lissur-dopmet-padrum.localhost/);
  assert.doesNotMatch(text, /tls_insecure_skip_verify|public\/full|Full moon/);
  const dup = endpoint => assert.throws(() => managedLocalCaddyfile({...options, ships: [...options.ships, {ship: '~nec', endpoint}]}), /unique effective endpoint/);
  dup({host: 'localhost', port: 8101, secure: false});
  dup({host: 'SHIP.EXAMPLE', port: 443, secure: true});
  dup({host: '127.0.0.1', port: 8083, secure: true});
  dup({host: 'localhost', port: 8091, secure: false});
  assert.throws(() => managedLocalCaddyfile({...options, ships: [options.ships[0], {...options.ships[0], port: 8105}]}), /unique Urbit/);
  const {execFileSync} = await import('node:child_process');
  try {execFileSync('caddy', ['version'], {stdio: 'pipe'});} catch {return;}
  // Adapt (rather than provision) remote hostnames without DNS/network access.
  const config = JSON.parse(execFileSync('caddy', ['adapt', '--adapter', 'caddyfile', '--config', '/dev/stdin'], {input: text, stdio: ['pipe', 'pipe', 'pipe']}));
  const transports = JSON.stringify(config).match(/"tls":\{[^}]*\}/g);
  assert.ok(transports?.length);
  assert.doesNotMatch(JSON.stringify(config), /insecure_skip_verify/);
});

test('managed app and external avatar validation', () => {
  assert.equal(appConfigProblem({landing: 'glurff', required: ['glurff']}), null);
  assert.equal(appConfigProblem({landing: 'landscape', required: []}), null);
  assert.ok(appConfigProblem({landing: '/apps/glurff/', required: []}));
  assert.ok(appConfigProblem({landing: 'glurff', required: ['glurff', 'glurff']}));
  assert.equal(externalAvatarProblem('https://example.com/avatar.png'), null);
  for (const url of ['data:image/png;base64,abc', 'javascript:alert(1)', '/avatar.png', 'https://a:b@example.com/x', 'https://bad host/x']) assert.ok(externalAvatarProblem(url));
});

test('a moon is free only when no visitor has it and Theseus says it is ready', () => {
  const now = 1_000_000;
  assert.equal(moonStatus({claim: null}, healthy, now).key, 'free');
  assert.equal(moonStatus({claim: null}, undefined, now).key, 'missing');
  assert.equal(moonStatus({claim: {at: 1, entered: 5, expires: null}}, healthy, now).key, 'in-use');
  assert.equal(moonStatus({claim: {at: 1, entered: null, expires: now + 1}}, healthy, now).key, 'link-sent');
  // a link that ran out unused frees the moon again
  assert.equal(moonStatus({claim: {at: 1, entered: null, expires: now - 1}}, healthy, now).key, 'free');
  assert.equal(moonStatus({claim: null}, {...healthy, recovery: {stage: 'registering'}}, now).key, 'resetting');
  assert.deepEqual(moonStatus({claim: null}, {...healthy, recovery: {stage: 'failed', reason: 'no keys'}}, now), {key: 'failed', label: 'reset failed', tone: 'bad', detail: 'no keys'});
  assert.equal(moonStatus({claim: null}, {...healthy, paused: true}, now).key, 'paused');
  assert.equal(moonStatus({claim: null}, {...healthy, status: 'degraded'}, now).key, 'down');
  assert.equal(moonStatus({claim: null}, {...healthy, desks: [{desk: 'glurff', stage: 'catching-up'}]}, now).key, 'catching');
  assert.equal(moonStatus({claim: null}, {...healthy, desks: [{desk: 'glurff', stage: 'failed'}]}, now).key, 'desk-failed');
  // a restore outranks a claim: the visitor's moon is going away
  assert.equal(moonStatus({claim: {at: 1, entered: 5}}, {...healthy, recovery: {stage: 'restarting'}}, now).key, 'resetting');
});

test('used moons are the ones with a claim', () => {
  assert.deepEqual(usedMoons([{ship: '~a', claim: {at: 1}}, {ship: '~b', claim: null}]), ['~a']);
});

test('reset progress counts reported recovery and readiness, including refusals', () => {
  const run = {ships: ['~a', '~b', '~c'], phase: 'requesting', priorLogKeys: ['1:old']};
  const rows = [{ship: '~a', status: {key: 'free'}}, {ship: '~b', status: {key: 'resetting'}}, {ship: '~c', status: {key: 'catching'}}];
  assert.deepEqual(resetProgress(run, rows), {total: 3, ready: 0, restoring: 0, catching: 0, failed: 0, waiting: 3, complete: false});
  const active = resetProgress({...run, phase: 'tracking'}, rows);
  assert.deepEqual(active, {total: 3, ready: 1, restoring: 1, catching: 1, failed: 0, waiting: 0, complete: false});
  const log = [{at: 2, text: 'Theseus refused to reset ~b. Its Dojo shows why.'}, {at: 1, text: 'old'}];
  const done = resetProgress({...run, phase: 'tracking'}, [{ship: '~a', status: {key: 'free'}}, {ship: '~b', status: {key: 'free'}}, {ship: '~c', status: {key: 'free'}}], log);
  assert.deepEqual(done, {total: 3, ready: 2, restoring: 0, catching: 0, failed: 1, waiting: 0, complete: true});
});

test('snapshot choices hold every moon of the fleet, newest first', () => {
  const fleet = {name: 'hosting', ships: ['~a', '~b']};
  const snaps = [
    {path: '/old/~a', set: '/old', ships: ['~a'], compatible: true, created: '~2026.10.1..1.0.0'},
    {path: '/old/~b', set: '/old', ships: ['~b'], compatible: true, created: '~2026.10.1..1.0.0'},
    {path: '/new/~a', set: '/new', ships: ['~a'], compatible: true, created: '~2026.10.9..1.0.0'},
    {path: '/new/~b', set: '/new', ships: ['~b'], compatible: false, created: '~2026.10.9..1.0.0'},
    {path: '/half/~a', set: '/half', ships: ['~a'], compatible: true, created: '~2026.10.9..2.0.0'},
  ];
  const choices = snapshotChoices(fleet, snaps);
  assert.deepEqual(choices.map(c => c.path), ['/new', '/old']);
  assert.equal(choices[0].compatible, false, 'one incompatible member marks the set');
  assert.deepEqual(snapshotChoices(undefined, snaps), []);
  assert.deepEqual(snapshotChoices({name: 'empty', ships: []}, snaps), []);
});

test('settings are checked as %manor checks them', () => {
  assert.equal(baseProblem('203-0-113-7.nip.io'), null);
  assert.equal(baseProblem(''), null, 'no address yet is allowed');
  assert.match(baseProblem('Bad Host'), /lowercase/);
  assert.equal(landingProblem('/apps/glurff/'), null);
  assert.match(landingProblem('apps/glurff'), /Start with/);
  assert.match(landingProblem('/apps/my app/'), /no spaces/);
  assert.equal(publicLink('x.nip.io'), 'https://join.x.nip.io/');
  assert.equal(publicLink(''), null);
});

test('small helpers', () => {
  assert.equal(shortMoon('~ritdex-sorled-siglup-narwet', '~siglup-narwet'), '~ritdex-sorled');
  assert.equal(shortMoon('~zod', '~siglup-narwet'), '~zod');
  assert.equal(daMs('~2026.10.7..23.9.41..1a2b'), Date.UTC(2026, 9, 7, 23, 9, 41));
  assert.throws(() => validateState({pool: []}), /unexpected/);
});

test('installed-app catalogs are optional on old state and validated when supplied', () => {
  const state = {pool: [], log: [], settings: {base: '', landing: '/apps/landscape/'}};
  assert.equal(validateState(state), state);
  const valid = [{desk: 'glurff', running: true, web: true}, {desk: 'noltbook-data', running: false, web: false}];
  assert.doesNotThrow(() => validateState({...state, controlled: {apps: valid}, managed: {ships: [{apps: null}]}}));
  for (const apps of ['glurff', [{desk: '../bad', running: true, web: true}], [{desk: 'base', running: 1, web: false}]]) {
    assert.throws(() => validateState({...state, controlled: {apps}}), /invalid app list/);
    assert.throws(() => validateState({...state, managed: {ships: [{apps}]}}), /invalid app list/);
  }
});

test('the front door Caddyfile is valid Caddy and exposes only manor and moons', async () => {
  const {caddyfile, frontProblem, FRONT_DEFAULTS} = await import('../src/model.mjs');
  const text = caddyfile({ship: '~siglup-narwet', eyre: 8083, base: '203-0-113-7.nip.io', ...FRONT_DEFAULTS, httpsPort: 9443});
  assert.match(text, /https_port 9443/);
  assert.match(text, /ask http:\/\/127\.0\.0\.1:8083\/apps\/manor\/public\/tls-ask/);
  assert.match(text, /import routes join\.203-0-113-7\.nip\.io/);
  assert.match(text, /health_body "\^~siglup-narwet\$"/);
  assert.match(text, /health_fails 3/);
  assert.match(text, /handle_errors 502 503 504/);
  // every route into the ship is manor's public paths or a moon
  const rewrites = [...text.matchAll(/rewrite \* (\S+)/g)].map(m => m[1]);
  assert.deepEqual(rewrites, ['/apps/manor/public{uri}', '/apps/manor/public/enter/~{re.moon.ship}?{query}', '/theseus/~{re.moon.ship}{uri}']);
  assert.equal(frontProblem(FRONT_DEFAULTS), null);
  assert.match(frontProblem({...FRONT_DEFAULTS, localPort: 8443}), /different/);
  assert.match(frontProblem({...FRONT_DEFAULTS, admin: 'nope'}), /admin/);
  // Caddy itself accepts it, when Caddy is installed here
  const {execFileSync} = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  let caddy = null;
  try {caddy = execFileSync('which', ['caddy']).toString().trim();} catch {}
  if (!caddy) return;
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'manor-caddy-')), 'Caddyfile');
  fs.writeFileSync(file, text);
  execFileSync(caddy, ['validate', '--config', file, '--adapter', 'caddyfile'], {stdio: 'pipe'});
});
