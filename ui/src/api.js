import Urbit from '@urbit/http-api';
import {validateProfiles, validateState} from './model.mjs';

export const api = new Urbit('');
window.addEventListener('pagehide', () => {if (api.lastEventId > 0) api.delete();});

export class SignedOut extends Error {}

async function scry(path) {
  const res = await fetch(`/~/scry/${path}.json`, {credentials: 'same-origin', cache: 'no-store'});
  if (res.status === 401 || res.status === 403 || res.redirected) throw new SignedOut('Sign in to your ship to manage Manor.');
  if (!res.ok) throw new Error(`/${path} returned HTTP ${res.status}.`);
  return res.json();
}

// %manor's pool, claims, settings and activity.
export const manorState = () => scry('manor/state').then(validateState);

// Theseus's moons, fleets and snapshots: readiness lives there.
export async function theseusState() {
  const data = await scry('theseus/ui');
  if (!Array.isArray(data?.moons) || !Array.isArray(data.fleets) || !Array.isArray(data.snapshots)) throw new Error('Theseus returned an unexpected state.');
  api.ship = String(data.host).replace(/^~/, '');
  return data;
}

// Each moon's name and picture, from its own Noltbook profile, as Theseus
// reads them. Read when the page opens and after a change, never on a timer.
export async function profiles() {
  return validateProfiles(await scry('theseus/profiles'));
}

// Names and pictures as they change, pushed by %theseus: one moon's profile
// row per fact, whenever its Noltbook profile changes, from anywhere (this
// page, Theseus, Noltbook itself). No polling. A failed or dropped
// subscription is made again on the next refresh.
let profilesStarted = false;
let stateStarted = false;
let uiStarted = false;
api.onError = () => {profilesStarted = false; stateStarted = false; uiStarted = false; api.reset();};

// "Something changed", pushed instead of read on a timer: %manor's pool,
// claims, settings or activity (/state), and Theseus's moons (/ui). The page
// reads them again when told.
function signal(app, path, flag, event) {
  return api.subscribe({app, path, event: () => event(), err: () => flag(false), quit: () => flag(false)})
    .catch(e => {flag(false); throw e;});
}
export async function watchManor(event) {
  if (stateStarted) return;
  stateStarted = true;
  return signal('manor', '/state', v => {stateStarted = v;}, event);
}
export async function watchUi(event) {
  if (uiStarted) return;
  uiStarted = true;
  return signal('theseus', '/ui', v => {uiStarted = v;}, event);
}
export async function watchProfiles(event) {
  if (profilesStarted) return;
  profilesStarted = true;
  const one = row => {try {validateProfiles({moons: [row]}); event(row);} catch { /* not a profile row */ }};
  try {
    return await api.subscribe({app: 'theseus', path: '/profiles', event: one,
      err: () => {profilesStarted = false;},
      quit: () => {profilesStarted = false;}});
  } catch (e) {profilesStarted = false; throw e;}
}

// Theseus's web gateway: each moon's own local address, where an uploaded
// Noltbook picture is served. Null when there is none.
export async function gateway() {
  const res = await fetch('/~/scry/theseus-ui/gateway.json', {credentials: 'same-origin', cache: 'no-store'});
  if (!res.ok) return null;
  const data = await res.json();
  return ['auto', 'declared', 'hosting'].includes(data?.mode) ? data : null;
}

// Resolves when the agent acknowledges the poke; a rejection means the host
// refused it (its Dojo shows why).
function poke(app, mark, json, rejected) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No answer from the host yet. It may still finish; check again in a moment.')), 60000);
    const finish = fn => value => {clearTimeout(timer); fn(value);};
    api.poke({app, mark, json,
      onSuccess: finish(resolve),
      onError: finish(() => reject(new Error(rejected))),
    }).catch(finish(reject));
  });
}

export const act = (action, rejected) => poke('manor', 'manor-action', action, rejected);

// A moon's name and picture, written to its Noltbook profile by %theseus:
// the same command the Theseus console sends. .upload is a new picture's
// bytes, which %theseus uploads inside the moon.
export const setProfile = (value, rejected) => poke('theseus', 'theseus-ui', {profile: value}, rejected);
