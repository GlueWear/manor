import test from 'node:test';
import assert from 'node:assert/strict';
import {baseProblem, daMs, landingProblem, moonStatus, publicLink, resetProgress, shortMoon, snapshotChoices, usedMoons, validateState} from '../src/model.mjs';

const healthy = {status: 'healthy', paused: false, recovery: null, desks: [{desk: 'base', stage: 'running'}]};

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
