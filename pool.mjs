#!/usr/bin/env node
// pool.mjs: the manor's moon pool, kept in step with the Theseus host.
//
//   node pool.mjs list                              the pool and who has what
//   node pool.mjs add ~moon... [--snapshot /name]   add moons, reading their codes
//   node pool.mjs snapshot ~moon /name              the clean snapshot to recycle to
//   node pool.mjs refresh [~moon...]                re-read codes from the host
//   node pool.mjs release ~moon...                  free moons without restoring
//   node pool.mjs remove ~moon...                   take moons out of the pool
//   node pool.mjs recycle (~moon... | --claimed) [--execute]
//
// recycle restores each moon to its clean snapshot, waits until the restore
// has finished and the moon is running, saves the moon's new +code (a restore
// gives the moon new keys, and the code comes from its key), then frees it.
// Without --execute it only says what it would do. A moon whose recycle fails
// stays held back ("recycle-error") until you recycle or release it.
//
// Talks to the host with its +code: state/host-code or MANOR_HOST_CODE.
// Codes are never printed.
import {settings, ship, readJson, writeJson, updateJson, hostCode, Host} from './lib/manor.mjs';

const cfg = settings();
let command = '', moons = [], flags = {_: []};

try {
  ({command, moons, flags} = parse(process.argv.slice(2)));
  switch (command) {
    case 'list': list(); break;
    case 'add': await add(); break;
    case 'snapshot': await setSnapshot(); break;
    case 'refresh': await refresh(); break;
    case 'release': release(); break;
    case 'remove': remove(); break;
    case 'recycle': await recycle(); break;
    default: usage();
  }
} catch (error) {
  console.error(`pool: ${error.message}`);
  process.exitCode = 1;
}

function list() {
  const pool = readJson(cfg.poolFile);
  const claims = readJson(cfg.claimsFile);
  const names = Object.keys(pool);
  if (!names.length) return console.log(`The pool is empty. Add moons with: node pool.mjs add ~moon`);
  const now = Date.now();
  const rows = names.map(moon => {
    const c = claims[moon];
    const state = !c ? 'free'
      : c.status ? c.status
      : c.entered ? `in use since ${c.entered}`
      : c.expires < now ? 'free (link expired unused)'
      : 'link sent';
    return [moon, state, pool[moon].snapshot || '(no snapshot)', pool[moon].code ? 'code saved' : 'NO CODE'];
  });
  const width = i => Math.max(...rows.map(r => r[i].length));
  for (const r of rows) console.log(r.map((v, i) => v.padEnd(width(i))).join('  '));
  const errors = names.filter(m => claims[m]?.error);
  for (const m of errors) console.log(`\n${m}: ${claims[m].error}`);
}

async function add() {
  need(moons.length, 'name at least one moon');
  const host = await connect();
  const ui = await host.scry('theseus/ui');
  if (flags.snapshot) need(moons.length === 1, '--snapshot applies to one moon at a time');
  const pool = readJson(cfg.poolFile);
  for (const moon of moons) {
    need(ui.moons.some(m => m.ship === moon), `${moon} is not a moon on ${host.name}`);
    if (flags.snapshot) checkSnapshot(ui, moon, flags.snapshot);
    pool[moon] = {...pool[moon], code: await codeOf(host, moon), snapshot: flags.snapshot || pool[moon]?.snapshot || null};
    console.log(`added ${moon}${pool[moon].snapshot ? `, recycles to ${pool[moon].snapshot}` : ''}`);
  }
  writeJson(cfg.poolFile, pool);
}

async function setSnapshot() {
  const [moon] = moons;
  const path = flags._[0];
  need(moon && path, 'usage: node pool.mjs snapshot ~moon /snapshot-name');
  need(readJson(cfg.poolFile)[moon], `${moon} is not in the pool`);
  const host = await connect();
  checkSnapshot(await host.scry('theseus/ui'), moon, path);
  updateJson(cfg.poolFile, pool => { pool[moon].snapshot = path; });
  console.log(`${moon} recycles to ${path}`);
}

async function refresh() {
  const pool = readJson(cfg.poolFile);
  const targets = moons.length ? moons : Object.keys(pool);
  const host = await connect();
  for (const moon of targets) {
    need(pool[moon], `${moon} is not in the pool`);
    const code = await codeOf(host, moon);
    console.log(`${moon}: ${code === pool[moon].code ? 'code unchanged' : 'code updated'}`);
    pool[moon].code = code;
  }
  writeJson(cfg.poolFile, pool);
}

function release() {
  need(moons.length, 'name at least one moon');
  updateJson(cfg.claimsFile, claims => { for (const m of moons) delete claims[m]; });
  console.log(`released ${moons.join(', ')}`);
}

function remove() {
  need(moons.length, 'name at least one moon');
  updateJson(cfg.poolFile, pool => { for (const m of moons) delete pool[m]; });
  updateJson(cfg.claimsFile, claims => { for (const m of moons) delete claims[m]; });
  console.log(`removed ${moons.join(', ')}`);
}

async function recycle() {
  const pool = readJson(cfg.poolFile);
  const claims = readJson(cfg.claimsFile);
  const targets = flags.claimed ? Object.keys(claims).filter(m => pool[m]) : moons;
  need(targets.length, flags.claimed ? 'no moon is claimed' : 'name moons, or use --claimed');
  for (const moon of targets) {
    need(pool[moon], `${moon} is not in the pool`);
    need(pool[moon].snapshot, `${moon} has no clean snapshot; set one with: node pool.mjs snapshot ${moon} /name`);
  }
  for (const moon of targets) console.log(`${flags.execute ? 'recycling' : 'would recycle'} ${moon} to ${pool[moon].snapshot}`);
  if (!flags.execute) return console.log('dry run: add --execute to restore and free these moons');

  const host = await connect();
  let failed = 0;
  for (const moon of targets) {
    try {
      await recycleOne(host, moon);
      console.log(`${moon}: restored, new code saved, free again`);
    } catch (error) {
      failed++;
      updateJson(cfg.claimsFile, c => { c[moon] = {...c[moon], status: 'recycle-error', at: new Date().toISOString(), error: error.message.slice(0, 500)}; });
      console.error(`${moon}: FAILED, held back: ${error.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

async function recycleOne(host, moon) {
  const {code: before, snapshot} = readJson(cfg.poolFile)[moon];
  checkSnapshot(await host.scry('theseus/ui'), moon, snapshot);
  // Any claim keeps /assign away from the moon while it is restored.
  updateJson(cfg.claimsFile, c => { c[moon] = {status: 'recycling', at: new Date().toISOString(), snapshot}; });
  await host.poke('theseus', 'theseus-recycle', {who: moon, path: snapshot});
  await waitUntilRestored(host, moon, Number(flags.timeout || 120) * 1000);
  const code = await codeOf(host, moon);
  if (code === before) throw new Error('the moon still has its old code, so the restore did not finish');
  updateJson(cfg.poolFile, pool => { pool[moon].code = code; });
  updateJson(cfg.claimsFile, c => { delete c[moon]; });
}

// Theseus restores a moon in stages. It is done when the moon has no
// recovery in progress and is running again; a failed recovery says why.
async function waitUntilRestored(host, moon, timeoutMs) {
  const started = Date.now();
  let seen = false;
  while (Date.now() - started < timeoutMs) {
    await new Promise(r => setTimeout(r, 1000));
    const row = (await host.scry('theseus/ui')).moons.find(m => m.ship === moon);
    if (!row) throw new Error(`${moon} is no longer on the host`);
    if (row.recovery) {
      seen = true;
      if (row.recovery.stage === 'failed') throw new Error(`the restore failed: ${row.recovery.reason || 'no reason given'}`);
      continue;
    }
    if (row.status === 'healthy' && !row.paused && (seen || Date.now() - started > 10_000)) return;
  }
  throw new Error(`the moon did not finish restoring within ${timeoutMs / 1000}s`);
}

// The recycle poke restores a snapshot holding exactly this one moon.
function checkSnapshot(ui, moon, path) {
  const snap = ui.snapshots.find(s => s.path === path);
  need(snap, `no snapshot ${path} on the host`);
  need(snap.ships.length === 1 && snap.ships[0] === moon, `snapshot ${path} holds ${snap.ships.join(', ')}, not just ${moon}`);
  need(snap.compatible !== false, `snapshot ${path} does not fit the host's current Theseus`);
}

async function codeOf(host, moon) {
  const web = await host.scry(`theseus/web/${moon}`);
  need(web?.code, `the host could not read ${moon}'s code; is the moon running?`);
  return String(web.code).replace(/^~/, '');
}

async function connect() {
  return new Host(cfg.hostUrl, hostCode(cfg)).login();
}

function need(ok, message) { if (!ok) throw new Error(message); }

function parse(argv) {
  const flags = {_: []};
  const moons = [];
  let command = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (['snapshot', 'timeout'].includes(key)) flags[key] = argv[++i];
      else flags[key] = true;
    } else if (!command) command = a;
    else if (a.startsWith('/')) flags._.push(a);
    else moons.push(ship(a));
  }
  return {command, moons, flags};
}

function usage() {
  console.log(`usage:
  node pool.mjs list
  node pool.mjs add ~moon... [--snapshot /name]
  node pool.mjs snapshot ~moon /name
  node pool.mjs refresh [~moon...]
  node pool.mjs release ~moon...
  node pool.mjs remove ~moon...
  node pool.mjs recycle (~moon... | --claimed) [--execute] [--timeout seconds]`);
  if (command) process.exitCode = 1;
}
