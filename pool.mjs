#!/usr/bin/env node
// pool.mjs: the manor's moon pool, kept in step with the Theseus host.
//
//   node pool.mjs list                              the pool and who has what
//   node pool.mjs add ~moon... [--snapshot /name]   add moons, reading their codes
//   node pool.mjs add --fleet <name> [--snapshot /set]  add every booted member of a fleet
//   node pool.mjs snapshot ~moon /name              the clean snapshot to recycle to
//   node pool.mjs refresh [~moon...]                re-read codes from the host
//   node pool.mjs release ~moon...                  free moons without restoring
//   node pool.mjs remove ~moon...                   take moons out of the pool
//   node pool.mjs recycle (~moon... | --claimed) [--execute]
//   node pool.mjs recycle-fleet /snapshot [--execute]
//
// Theseus keeps one snapshot per moon. A fleet snapshot is a set of them,
// /<set>/<~moon>, so a moon's clean snapshot can be its own or a set's.
// recycle restores just the named moons; recycle-fleet restores a whole set
// (or a pre-set snapshot holding many moons) at once. Either waits until the restore has finished and
// the moons are running, saves each moon's new +code (a restore gives a moon
// new keys, and the code comes from its key), then frees them. Without
// --execute they only say what they would do. A moon whose recycle fails stays
// held back ("recycle-error") until you recycle or release it.
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
    case 'recycle-fleet': await recycleFleet(); break;
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
  need(moons.length || flags.fleet, 'name moons, or use --fleet <name>');
  const host = await connect();
  const ui = await host.scry('theseus/ui');
  const targets = [...moons];
  if (flags.fleet) {
    const group = (ui.fleets || []).find(f => f.name === flags.fleet);
    need(group, `no fleet named ${flags.fleet} on ${host.name}`);
    const booted = new Set(ui.moons.map(m => m.ship));
    const waiting = group.ships.filter(m => !booted.has(m));
    if (waiting.length) console.log(`skipping ${waiting.length} members not booted yet: ${waiting.join(', ')}`);
    for (const m of group.ships) if (booted.has(m) && !targets.includes(m)) targets.push(m);
  }
  const pool = readJson(cfg.poolFile);
  for (const moon of targets) {
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
  const problem = (await waitUntilRestored(host, [moon], Number(flags.timeout || 120) * 1000))[moon];
  if (problem) throw new Error(problem);
  await saveNewCode(host, moon, before);
}

async function recycleFleet() {
  const path = flags._[0];
  need(path, 'usage: node pool.mjs recycle-fleet /snapshot [--execute]');
  const pool = readJson(cfg.poolFile);
  const host = await connect();
  const snap = findSnapshot(await host.scry('theseus/ui'), path);
  need(snap, `no snapshot ${path} on the host`);
  need(snap.compatible !== false, `snapshot ${path} does not fit the host's current Theseus`);
  const targets = snap.ships.filter(m => pool[m]);
  need(targets.length, `snapshot ${path} holds none of the pool's moons`);
  const outside = Object.keys(pool).filter(m => !snap.ships.includes(m));
  const extra = snap.ships.filter(m => !pool[m]);
  console.log(`${flags.execute ? 'restoring' : 'would restore'} ${path}: ${snap.ships.length} moons, ${targets.length} of them in the pool`);
  if (outside.length) console.log(`not in this snapshot, so left as they are: ${outside.join(', ')}`);
  if (extra.length) console.log(`restored too, though not in the pool: ${extra.join(', ')}`);
  if (!flags.execute) return console.log('dry run: add --execute to restore and free these moons');

  const before = Object.fromEntries(targets.map(m => [m, pool[m].code]));
  const at = new Date().toISOString();
  // Hold every moon back from /assign until it is restored and has its code.
  updateJson(cfg.claimsFile, c => { for (const m of targets) c[m] = {status: 'recycling', at, snapshot: path}; });
  try {
    await host.poke('theseus', 'theseus-ui', {restore: {path}});
  } catch (error) {
    holdBack(targets, error.message);
    throw error;
  }
  const problems = await waitUntilRestored(host, snap.ships, Number(flags.timeout || 300) * 1000);
  let failed = 0;
  for (const moon of targets) {
    try {
      if (problems[moon]) throw new Error(problems[moon]);
      await saveNewCode(host, moon, before[moon]);
    } catch (error) {
      failed++;
      holdBack([moon], error.message);
      console.error(`${moon}: FAILED, held back: ${error.message}`);
    }
  }
  for (const moon of extra) if (problems[moon]) console.error(`${moon} (not in the pool): ${problems[moon]}`);
  console.log(`${targets.length - failed} of ${targets.length} pool moons restored, new codes saved, free again`);
  if (failed) process.exitCode = 1;
}

// A restore gives the moon new keys, so its code must change.
async function saveNewCode(host, moon, before) {
  const code = await codeOf(host, moon);
  if (code === before) throw new Error('the moon still has its old code, so the restore did not finish');
  updateJson(cfg.poolFile, pool => { pool[moon].code = code; });
  updateJson(cfg.claimsFile, c => { delete c[moon]; });
}

function holdBack(list, message) {
  const at = new Date().toISOString();
  updateJson(cfg.claimsFile, c => { for (const m of list) c[m] = {...c[m], status: 'recycle-error', at, error: message.slice(0, 500)}; });
}

// Theseus restores each moon in stages. A moon is done when it has no
// recovery in progress and is running again; a failed recovery says why.
// Returns each moon's problem, or nothing for those that came back.
async function waitUntilRestored(host, list, timeoutMs) {
  const started = Date.now();
  const seen = new Set();
  const pending = new Set(list);
  const problems = {};
  while (pending.size && Date.now() - started < timeoutMs) {
    await new Promise(r => setTimeout(r, 1000));
    const rows = new Map((await host.scry('theseus/ui')).moons.map(m => [m.ship, m]));
    for (const moon of [...pending]) {
      const row = rows.get(moon);
      if (!row) { problems[moon] = `${moon} is no longer on the host`; pending.delete(moon); continue; }
      if (row.recovery) {
        seen.add(moon);
        if (row.recovery.stage === 'failed') {
          problems[moon] = `the restore failed: ${row.recovery.reason || 'no reason given'}`;
          pending.delete(moon);
        }
        continue;
      }
      if (row.status === 'healthy' && !row.paused && (seen.has(moon) || Date.now() - started > 10_000)) pending.delete(moon);
    }
    if (list.length > 1) process.stdout.write(`\r${list.length - pending.size} of ${list.length} moons back`);
  }
  if (list.length > 1) process.stdout.write('\n');
  for (const moon of pending) problems[moon] = `the moon did not finish restoring within ${timeoutMs / 1000}s`;
  return problems;
}

// A snapshot by path, or a set: every snapshot in it, as one.
function findSnapshot(ui, path) {
  const exact = ui.snapshots.find(s => s.path === path);
  if (exact) return exact;
  const members = ui.snapshots.filter(s => s.set === path);
  if (!members.length) return null;
  return {path, ships: members.flatMap(s => s.ships), compatible: members.every(s => s.compatible !== false)};
}
// The recycle poke restores the moon's own snapshot: one holding just it, or
// its snapshot in a set.
function checkSnapshot(ui, moon, path) {
  const snap = ui.snapshots.find(s => s.path === path) || ui.snapshots.find(s => s.set === path && s.ships.length === 1 && s.ships[0] === moon);
  need(snap || findSnapshot(ui, path), `no snapshot ${path} on the host`);
  need(snap && snap.ships.length === 1 && snap.ships[0] === moon, `snapshot ${path} has no snapshot of just ${moon}`);
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
      if (['snapshot', 'timeout', 'fleet'].includes(key)) flags[key] = argv[++i];
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
  node pool.mjs add --fleet <name> [--snapshot /set]
  node pool.mjs snapshot ~moon /name
  node pool.mjs refresh [~moon...]
  node pool.mjs release ~moon...
  node pool.mjs remove ~moon...
  node pool.mjs recycle (~moon... | --claimed) [--execute] [--timeout seconds]
  node pool.mjs recycle-fleet /snapshot [--execute] [--timeout seconds]`);
  if (command) process.exitCode = 1;
}
