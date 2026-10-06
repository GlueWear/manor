// Shared by the broker and pool.mjs: settings, the state files, and talking
// to the Theseus host ship over its Eyre.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const MANOR_HOME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Everything comes from the environment (./manor loads manor.env).
export function settings(env = process.env) {
  const at = (value, fallback) => path.resolve(MANOR_HOME, value || fallback);
  return {
    hostUrl: trimSlash(env.MANOR_HOST_URL || 'http://127.0.0.1:8083'),
    base: String(env.MANOR_BASE || '').toLowerCase(),
    landing: env.MANOR_LANDING || '/apps/noltbook/',
    brokerPort: Number(env.MANOR_BROKER_PORT || 8091),
    poolFile: at(env.MANOR_POOL_FILE, 'state/pool.json'),
    claimsFile: at(env.MANOR_CLAIMS_FILE, 'state/claims.json'),
    hostCodeFile: at(env.MANOR_HOST_CODE_FILE, 'state/host-code'),
  };
}

// A ship as ~name. Moons are two to four words: ~dozpen-mignes-magtel,
// ~ribmut-mogwyn-siglup-narwet.
export function ship(name) {
  const s = String(name || '').trim().toLowerCase().replace(/^~/, '');
  if (!/^[a-z]{3,6}(-[a-z]{6})*$/.test(s)) throw new Error(`not a ship name: ${name}`);
  return `~${s}`;
}
export const label = name => ship(name).slice(1);

// ---- state files -----------------------------------------------------------
//
//   state/pool.json    { "~moon": { "code": "<+code>", "snapshot": "/name" } }
//   state/claims.json  { "~moon": { "at": ..., ... } }  any entry = not free
//
// A missing file is empty. Writes go to a temp file renamed into place, so a
// reader never sees half a file, with mode 600: the pool holds login codes.

export function readJson(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  let value;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error(`${file}: ${error.message}`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${file}: expected a JSON object`);
  return value;
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  fs.renameSync(temp, file);
}

// Read, change and write back in one go.
export function updateJson(file, change) {
  const value = readJson(file);
  change(value);
  writeJson(file, value);
  return value;
}

// One-time tickets from /assign to /broker. Only their hash is stored.
export const newTicket = () => crypto.randomBytes(24).toString('base64url');
export const digest = ticket => crypto.createHash('sha256').update(String(ticket)).digest('hex');

// ---- the host --------------------------------------------------------------

// Log into a moon through the host's /theseus/~<moon> route with the moon's
// +code. Returns the moon's own session cookie (Set-Cookie value), or null.
export async function moonLogin(hostUrl, moon, code) {
  const response = await fetch(`${hostUrl}/theseus/${moon}/~/login`, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({password: code, redirect: '/'}),
    redirect: 'manual',
  });
  await response.arrayBuffer();
  // Never pass on any other cookie, such as the host's own session.
  return response.headers.getSetCookie().find(c => c.startsWith(`urbauth-${moon}=`)) || null;
}

// The host's +code: MANOR_HOST_CODE, or the host code file. Never logged.
export function hostCode(cfg, env = process.env) {
  let code = env.MANOR_HOST_CODE || '';
  if (!code) {
    try { code = fs.readFileSync(cfg.hostCodeFile, 'utf8'); }
    catch { /* reported below */ }
  }
  code = code.trim().replace(/^~/, '');
  if (!code) throw new Error(`no host +code: run +code in the host's Dojo and save it to ${cfg.hostCodeFile} (chmod 600)`);
  return code;
}

// A logged-in session on the host's Eyre: Theseus scries and pokes.
export class Host {
  constructor(url, code) {
    this.url = trimSlash(url);
    this.code = code;
    this.cookie = '';
    this.name = '';
  }

  async login() {
    const who = await fetch(`${this.url}/~/host`).then(r => r.text()).catch(() => '');
    if (!who.startsWith('~')) throw new Error(`no Urbit ship answers at ${this.url}`);
    this.name = who.trim();
    const response = await fetch(`${this.url}/~/login`, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({password: this.code}),
      redirect: 'manual',
    });
    await response.arrayBuffer();
    const cookie = response.headers.getSetCookie().find(c => c.startsWith('urbauth-'));
    if (!cookie) throw new Error(`could not log into ${this.name} (HTTP ${response.status}); check the host +code`);
    this.cookie = cookie.split(';')[0];
    return this;
  }

  async scry(spur) {
    const response = await fetch(`${this.url}/~/scry/${spur}.json`, {headers: {cookie: this.cookie}});
    if (!response.ok) throw new Error(`scry /${spur} returned HTTP ${response.status}`);
    return response.json();
  }

  // Poke an agent on the host and wait for its acknowledgement. A rejection
  // throws with the host's error trace.
  async poke(app, mark, json, timeoutMs = 30_000) {
    const channel = `${this.url}/~/channel/manor-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const auth = {cookie: this.cookie};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const put = await fetch(channel, {
        method: 'PUT',
        headers: {...auth, 'content-type': 'application/json'},
        body: JSON.stringify([{id: 1, action: 'poke', ship: this.name.slice(1), app, mark, json}]),
        signal: controller.signal,
      });
      await put.arrayBuffer();
      if (!put.ok) throw new Error(`channel PUT returned HTTP ${put.status}`);
      const events = await fetch(channel, {headers: {...auth, accept: 'text/event-stream'}, signal: controller.signal});
      if (!events.ok || !events.body) throw new Error(`channel stream returned HTTP ${events.status}`);
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of events.body) {
        buffer += decoder.decode(chunk, {stream: true});
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
          let message;
          try { message = JSON.parse(data); } catch { continue; }
          if (message.id !== 1 || message.response !== 'poke') continue;
          if ('err' in message) throw new Error(`the host rejected the poke: ${String(message.err).trim()}`);
          return;
        }
      }
      throw new Error('the channel closed before the poke was acknowledged');
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`no acknowledgement within ${timeoutMs / 1000}s; the action may still finish`);
      throw error;
    } finally {
      clearTimeout(timer);
      await fetch(channel, {method: 'DELETE', headers: auth}).then(r => r.arrayBuffer()).catch(() => {});
    }
  }
}

export function trimSlash(s) { return String(s).replace(/\/+$/, ''); }
