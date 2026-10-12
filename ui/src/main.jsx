import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AlertCircle, ArrowUpRight, Check, Copy, DoorOpen, Download, Folder, History, ImageUp, Link2, LoaderCircle, Pencil, RotateCcw, Settings, Trash2, Unlock, Users, X} from 'lucide-react';
import '@urbit/sigil-js';
import {act, gateway, manorState, profiles as fetchProfiles, setProfile, theseusState, watchManor, watchProfiles, watchUi, SignedOut} from './api';
import {avatarSrc, baseProblem, caddyfile, daMs, FRONT_DEFAULTS, frontProblem, landingProblem, moonOrigin, moonStatus, publicLink, resetProgress, snapshotChoices, usedMoons} from './model.mjs';
import './style.css';

const time = ms => new Date(ms).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
const day = ms => new Date(ms).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const statusView = status => <>
  <span className={`badge ${status.tone}`} title={status.detail}><i/>{status.label}</span>
  {status.since && <span className="muted when">since {time(status.since)}</span>}
  {status.until && <span className="muted when">link works until {time(status.until)}</span>}
</>;

// A moon's picture: its Noltbook picture, else its planet's sigil, as in
// Theseus. A picture that fails to load falls back to the sigil too.
function ShipIcon({ship, size}) {
  const ref = useRef();
  const parent = ship.split('-').slice(-2).join('-').replace(/^~/, '');
  useEffect(() => {
    const icon = document.createElement('urbit-sigil');
    Object.entries({point: parent, size, foreground: '#364a5a', background: '#f3e8d4', detail: 'none', space: 'none'}).forEach(([k, v]) => icon.setAttribute(k, String(v)));
    ref.current.replaceChildren(icon);
  }, [parent, size]);
  return <span ref={ref} className="sigil" aria-hidden="true" style={{width: size, height: size}}/>;
}
function ShipAvatar({ship, profile, origin, size = 42}) {
  const src = avatarSrc(profile?.avatar, origin, ship);
  const [failed, setFailed] = useState('');
  if (src && failed !== src) return <img className="avatar" src={src} alt="" referrerPolicy="no-referrer" style={{width: size, height: size}} onError={() => setFailed(src)}/>;
  return <ShipIcon ship={ship} size={size}/>;
}
// A chosen name in bold with the full @p under it; names are picked
// freely, so the @p is what identifies the moon.
function ShipName({ship, profile}) {
  const name = profile?.name?.trim();
  return name ? <span className="ship-name"><strong>{name}</strong><small>{ship}</small></span> : <span className="ship-name"><strong>{ship}</strong></span>;
}
// On a moon running Noltbook its picture and name open the editor; on any
// other they are only shown.
function ShipIdentity({ship, profile, origin, edit, disabled}) {
  const name = profile?.name?.trim();
  const inner = <><span className="avatar-wrap"><ShipAvatar ship={ship} profile={profile} origin={origin}/>{edit && <span className="avatar-edit" aria-hidden="true"><Pencil size={11} strokeWidth={2.5}/></span>}</span><ShipName ship={ship} profile={profile}/></>;
  if (!edit) return <span className="ship-link">{inner}</span>;
  return <button type="button" className="ship-link editable" aria-label={`${name ? `${name} (${ship})` : ship}: edit name and picture`} title={disabled ? undefined : 'Edit name and picture'} disabled={disabled} onClick={edit}>{inner}</button>;
}
// A chosen picture, made small enough for Noltbook as Noltbook's own page
// does: at most 128 pixels a side, as a JPEG. Transparent parts turn white.
const PICTURE_MAX = 51200;
function shrinkPicture(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type) || file.size > 20e6) return reject(new Error('Choose a picture file (PNG, JPEG, GIF or WebP) under 20 MB.'));
    const img = new Image(), src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      const scale = Math.min(128 / img.width, 128 / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', 0.7), base64 = url.slice(url.indexOf(',') + 1);
      const bytes = Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
      if (bytes > PICTURE_MAX) return reject(new Error('This picture is still too large for Noltbook after shrinking. Try a simpler one.'));
      resolve({url, base64, name: file.name, width: canvas.width, height: canvas.height});
    };
    img.onerror = () => {URL.revokeObjectURL(src); reject(new Error('That file could not be read as a picture.'));};
    img.src = src;
  });
}

function IconButton({label, children, ...props}) {
  return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}

// The front door's Caddy options are this browser's: remembered here only.
const FRONT_KEY = 'manor.front';
function loadFront() {
  try {return {...FRONT_DEFAULTS, ...JSON.parse(localStorage.getItem(FRONT_KEY) || '{}')};}
  catch {return {...FRONT_DEFAULTS};}
}
function saveFront(value) {
  try {localStorage.setItem(FRONT_KEY, JSON.stringify(value));} catch { /* private window */ }
}

function FrontDoor({manor, notify, fail}) {
  const [front, setFront] = useState(loadFront);
  const set = change => setFront(current => {const next = {...current, ...change}; saveFront(next); return next;});
  const base = manor.settings.base;
  const problem = frontProblem(front);
  const text = base && !problem ? caddyfile({ship: manor.host, eyre: manor.eyre, base, ...front}) : '';
  function download() {
    const url = URL.createObjectURL(new Blob([text], {type: 'application/octet-stream'}));
    const a = document.createElement('a'); a.href = url; a.download = 'Caddyfile'; a.click(); URL.revokeObjectURL(url);
  }
  async function copy() {
    try {await navigator.clipboard.writeText(text); notify('Copied the Caddyfile.');}
    catch {fail('Copy failed. Open the Caddyfile below and copy it by hand.');}
  }
  const port = (label, key) => <label>{label}<input aria-label={label} inputMode="numeric" value={front[key]} onChange={e => set({[key]: Number(e.target.value.replace(/\D/g, '')) || 0})}/></label>;
  return <section className="card" aria-labelledby="front-title">
    <h2 id="front-title"><DoorOpen size={18}/>Front door</h2>
    <p className="muted">{manor.front ? `Last visit through it: ${day(manor.front)}.` : 'No visits through it yet.'}</p>
    {!base ? <p className="hint">Set the public address under Settings first.</p> : <>
      <p className="hint">Caddy runs next to {manor.host}, outside Urbit. It gives each moon its own secure address and passes on only Manor's public pages and moon traffic.</p>
      <ol className="steps">
        <li>Install Caddy once: on a Mac <code>brew install caddy</code>, on Linux from your package manager, on Windows from caddyserver.com.</li>
        <li>Save this Caddyfile on the machine running {manor.host}, and in its folder run <code>caddy run --config Caddyfile --adapter caddyfile</code>.</li>
        <li>On your router, forward public TCP port 443 to that machine's port {front.httpsPort}.</li>
        <li>Try <code>http://join.localhost:{front.localPort}/</code> on that machine, then the public link from a phone on mobile data.</li>
      </ol>
      <div className="front-fields">
        {port('HTTPS port', 'httpsPort')}
        {port('Test port', 'localPort')}
        <label>Caddy admin<input aria-label="Caddy admin" value={front.admin} spellCheck="false" onChange={e => set({admin: e.target.value.trim()})}/></label>
      </div>
      <label className="check"><input type="checkbox" checked={front.staging} onChange={e => set({staging: e.target.checked})}/>Trial certificates (Let's Encrypt staging: no rate limits, but browsers warn)</label>
      {problem ? <p className="form-error" role="alert">{problem}</p> : <>
        <div className="tools"><button type="button" className="primary" onClick={download}><Download size={15}/>Download Caddyfile</button><button type="button" onClick={copy}><Copy size={15}/>Copy</button></div>
        <details className="config"><summary>Show the Caddyfile</summary><pre data-testid="caddyfile">{text}</pre></details>
      </>}
    </>}
  </section>;
}

function Dialog({title, children, close, busy}) {
  const ref = useRef();
  useEffect(() => {ref.current.showModal();}, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={e => {e.preventDefault(); if (!busy) close();}}>
    <header><h2 id="dialog-title">{title}</h2><IconButton label="Close dialog" onClick={close} disabled={busy}><X size={18}/></IconButton></header>
    {children}
  </dialog>;
}

function App() {
  const [manor, setManor] = useState(null);
  const [theseus, setTheseus] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState({base: '', landing: ''});
  const [profileData, setProfileData] = useState(null);
  const [gw, setGw] = useState(undefined);
  const [resetRun, setResetRun] = useState(null);
  const mounted = useRef(true);
  const editedSettings = useRef(false);

  // The page reads Manor and Theseus when it opens, when either says
  // something changed, and when the tab is shown again. No timer, except
  // one retry at a time while the host can't be reached.
  const refreshing = useRef(false);
  const again = useRef(false);
  const retry = useRef(null);
  function scheduleRefresh() {
    if (refreshing.current) {again.current = true; return;}
    refresh();
  }
  function retryIn(ms) {
    clearTimeout(retry.current);
    retry.current = setTimeout(() => {retry.current = null; scheduleRefresh();}, ms);
  }
  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const [m, t] = await Promise.all([manorState(), theseusState()]);
      if (!mounted.current) return;
      setManor(m); setTheseus(t); setSignedOut(false); setLoadError(''); setNow(Date.now());
      if (!editedSettings.current) setSettings(m.settings);
      watchManor(scheduleRefresh).catch(() => retryIn(5000));
      watchUi(scheduleRefresh).catch(() => retryIn(5000));
      watchProfiles(applyProfile).catch(() => retryIn(5000));
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof SignedOut) setSignedOut(true);
      else {setLoadError(err.message); retryIn(10000);}
    } finally {
      refreshing.current = false;
      if (again.current && mounted.current) {again.current = false; setTimeout(refresh, 0);}
    }
  }
  useEffect(() => {
    mounted.current = true; refresh();
    const shown = () => {if (document.visibilityState === 'visible') scheduleRefresh();};
    document.addEventListener('visibilitychange', shown);
    return () => {mounted.current = false; clearTimeout(retry.current); document.removeEventListener('visibilitychange', shown);};
  }, []);
  // Names and pictures are read when something happens, never on a timer:
  // on opening, and after a change, a reset or a new fleet. After that,
  // %theseus pushes each change (/profiles), wherever it was made, and it
  // replaces that moon's row. The page works without them.
  function applyProfile(row) {
    if (!mounted.current) return;
    setProfileData(cur => {
      if (!cur) return cur;
      const known = cur.moons.some(m => m.ship === row.ship);
      return {...cur, moons: known ? cur.moons.map(m => m.ship === row.ship ? row : m) : [...cur.moons, row]};
    });
  }
  async function loadProfiles() {
    try {const next = await fetchProfiles(); if (mounted.current) setProfileData(next);} catch { /* shown without names */ }
  }
  useEffect(() => {
    if (!manor || profileData) return;
    loadProfiles();
    gateway().then(g => mounted.current && setGw(g)).catch(() => mounted.current && setGw(null));
  }, [manor]);

  // An admin action: errors show in the open dialog, or else on the page.
  async function run(action, done, rejected, report = setError) {
    if (busy) return false;
    setBusy(true); setError(''); setNotice(''); setFormError('');
    try {
      await act(action, rejected); await refresh(); if (done) setNotice(done);
      if (action.connect) setResetRun(null);
      if (action.connect || action.reset) loadProfiles();
      return true;
    }
    catch (err) {report(err.message); return false;}
    finally {setBusy(false);}
  }
  function open(type, value) {setFormError(''); setModal({type, value}); setForm({});}
  const profileOf = ship => profileData?.moons.find(p => p.ship === ship) || null;
  const editable = ship => !!profileOf(ship)?.noltbook;
  const avatarOrigin = ship => moonOrigin(gw, ship);
  function openProfile(ship) {
    const p = profileOf(ship);
    if (!p?.noltbook) return;
    setFormError('');
    setModal({type: 'profile', value: {...p, ship, paused: !!theseus?.moons.find(m => m.ship === ship)?.paused}});
    setForm({name: p.name || '', avatar: p.avatar?.type === 'external' ? p.avatar.url : '', clearAvatar: false, picture: null});
  }
  async function pickPicture(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFormError('');
    try {const picture = await shrinkPicture(file); setForm(f => ({...f, picture, avatar: '', clearAvatar: false}));}
    catch (err) {setFormError(err.message);}
  }
  // A moon's name and picture go to its Noltbook profile through %theseus.
  async function saveProfile(value) {
    const payload = {who: value.ship};
    const name = (form.name || '').trim();
    if (name !== (value.name || '')) payload.name = name || null;
    if (form.picture) {
      if (value.paused) return setFormError(`Resume ${value.ship} in Theseus to give it a new picture.`);
      payload.upload = form.picture.base64;
    } else {
      const url = (form.avatar || '').trim();
      const had = value.avatar?.type === 'external' ? value.avatar.url : '';
      if (form.clearAvatar && !url) payload.avatar = null;
      else if (url && url !== had) {
        if (!/^https?:\/\/\S+$/i.test(url)) return setFormError('Use a picture address that starts with https://');
        payload.avatar = url;
      }
    }
    if (Object.keys(payload).length === 1) return setModal(null);
    if (busy) return;
    setBusy(true); setError(''); setNotice(''); setFormError('');
    try {
      await setProfile(payload, payload.upload ? `${value.ship}'s Noltbook did not take the picture; the host's Dojo shows the reason.` : 'The host refused this change. Its Dojo shows why.');
      await loadProfiles(); setModal(null); setNotice(`Saved the name and picture of ${value.ship}.`);
    } catch (err) {setFormError(err.message);}
    finally {setBusy(false);}
  }

  const host = theseus?.host;
  const moons = new Map((theseus?.moons || []).map(m => [m.ship, m]));
  const pool = [...(manor?.pool || [])].sort((a, b) => a.ship.localeCompare(b.ship));
  const rows = pool.map(row => ({...row, status: moonStatus(row, moons.get(row.ship), now)}));
  const reset = resetProgress(resetRun, rows, manor?.log || []);
  const count = key => rows.filter(r => r.status.key === key).length;
  const used = usedMoons(pool);
  // A link to a moon runs out on its own: show it as free then. This only
  // redraws the page; it asks the host nothing.
  const nextExpiry = Math.min(...pool.map(r => r.claim?.expires).filter(t => t && t > now), Infinity);
  useEffect(() => {
    if (nextExpiry === Infinity) return;
    const timer = setTimeout(() => setNow(Date.now()), nextExpiry - Date.now() + 500);
    return () => clearTimeout(timer);
  }, [nextExpiry]);
  const link = publicLink(manor?.settings.base || '');
  const fleet = manor?.fleet;
  const loading = !manor && !loadError && !signedOut;

  async function confirm(e) {
    e.preventDefault();
    const {type, value} = modal;
    if (type === 'profile') return saveProfile(value);
    if (type === 'connect') {
      if (!form.fleet || !form.snapshot) return setFormError('Choose a fleet and a snapshot.');
      if (await run({connect: {fleet: form.fleet, snapshot: form.snapshot}}, `Connected fleet ${form.fleet}.`, 'The host refused to connect this fleet. Its Dojo shows why.', setFormError)) setModal(null);
      return;
    }
    const verb = {release: 'Freed', remove: 'Removed'}[type];
    if (type === 'reset') setResetRun({ships: value.ships, phase: 'requesting', priorLogKeys: (manor?.log || []).map(entry => `${entry.at}:${entry.text}`)});
    const ok = await run({[type]: {ships: value.ships}}, type === 'reset' ? '' : `${verb} ${value.ships.length === 1 ? value.ships[0] : plural(value.ships.length, 'moon')}.`, 'The host refused this. Its Dojo shows why.', setFormError);
    if (type === 'reset') setResetRun(current => current && {...current, phase: ok ? 'tracking' : 'error'});
    if (ok) setModal(null);
  }
  async function saveSettings(e) {
    e.preventDefault();
    const base = settings.base.trim().toLowerCase(), landing = settings.landing.trim();
    const problem = baseProblem(base) || landingProblem(landing);
    if (problem) return setError(problem);
    if (await run({settings: {base, landing}}, 'Settings saved.', 'The host refused these settings.')) editedSettings.current = false;
  }
  async function copyLink() {
    try {await navigator.clipboard.writeText(link); setNotice('Copied the public link.');}
    catch {setError('Copy failed. Select the link and copy it by hand.');}
  }

  const choices = modal?.type === 'connect' ? snapshotChoices((theseus?.fleets || []).find(f => f.name === form.fleet), theseus?.snapshots || []) : [];
  const chosenFleet = modal?.type === 'connect' && (theseus?.fleets || []).find(f => f.name === form.fleet);

  return <div className="page">
    <header className="top">
      <div className="top-inner">
        <div className="brand"><img src="/apps/manor/icon.png" alt="" className="brand-icon"/><div><span className="brand-kicker">MOON HOSTING</span><h1>Manor</h1><span className="brand-subtitle">{host ? `Visitor pool on ${host}` : 'Visitor pool'}</span></div></div>
        <a className="out-link" href="/apps/theseus/">Open Theseus <ArrowUpRight size={14}/></a>
      </div>
    </header>

    <div className="workspace">

    {signedOut && <div role="alert" className="banner error"><AlertCircle size={18}/><span>Sign in to your ship to manage Manor.</span><a href="/~/login?redirect=/apps/manor">Sign in <ArrowUpRight size={14}/></a></div>}
    {loadError && <div role="alert" className="banner error"><AlertCircle size={18}/><span>{loadError}</span></div>}
    {error && <div role="alert" className="banner error"><AlertCircle size={18}/><span>{error}</span><IconButton label="Dismiss error" onClick={() => setError('')}><X size={16}/></IconButton></div>}
    {notice && <div role="status" className="banner success"><Check size={17}/><span>{notice}</span><IconButton label="Dismiss" onClick={() => setNotice('')}><X size={16}/></IconButton></div>}
    {reset && <section className={`reset-progress ${reset.failed || resetRun.phase === 'error' ? 'has-error' : ''}`} role="status" aria-label="Reset progress">
      <div className="reset-progress-head">
        <div><span className="reset-eyebrow">FLEET OPERATION</span><strong>{resetRun.phase === 'error' ? 'Reset request not confirmed' : resetRun.phase === 'requesting' ? 'Requesting reset' : reset.complete ? reset.failed ? 'Reset needs attention' : 'Reset complete' : 'Restoring moons'}</strong></div>
        <IconButton label="Dismiss reset progress" onClick={() => setResetRun(null)}><X size={16}/></IconButton>
      </div>
      <progress aria-label="Moons ready after reset" max={reset.total} value={resetRun.phase === 'requesting' ? undefined : reset.ready + reset.failed}/>
      <div className="reset-progress-detail">
        <span>{reset.ready} of {reset.total} ready</span>
        {reset.restoring > 0 && <span>{reset.restoring} restoring</span>}
        {reset.catching > 0 && <span>{reset.catching} catching up</span>}
        {reset.failed > 0 && <span className="reset-fail">{reset.failed} failed</span>}
        {reset.waiting > 0 && <span>{reset.waiting} awaiting status</span>}
        {resetRun.phase === 'error' && <span>Check the host before trying again.</span>}
      </div>
    </section>}
    {busy && resetRun?.phase !== 'requesting' && <div className="pending" role="status"><LoaderCircle size={16} className="spin"/>Waiting for the host</div>}
    {loading && <div className="pending" role="status"><LoaderCircle size={16} className="spin"/>Loading</div>}

    {manor && <>
      <div className="overview-grid">
      <section className="card" aria-labelledby="link-title">
        <h2 id="link-title"><Link2 size={18}/>Public link</h2>
        {link ? <div className="link-row"><a href={link} target="_blank" rel="noreferrer" className="public-link">{link}</a><button type="button" onClick={copyLink}><Copy size={15}/>Copy</button></div>
          : <p className="muted">No public address yet. Set one under Settings.</p>}
        <p className="hint">Visitors pull the lever there and land in {manor.settings.landing} on a free moon.</p>
      </section>

      <section className="card" aria-labelledby="fleet-title">
        <h2 id="fleet-title"><Folder size={18}/>Fleet</h2>
        <div className="fleet-row">
          {fleet ? <p><strong>{fleet.name}</strong> <span className="muted">· {plural(pool.length, 'moon')}, reset from {fleet.snapshot}</span></p>
            : <p className="muted">No fleet connected. Boot one in Theseus, take a fleet snapshot, then connect it here.</p>}
          <button type="button" className={fleet ? '' : 'primary'} disabled={busy || !theseus} onClick={() => open('connect')}>{fleet ? 'Change fleet' : 'Connect a fleet'}</button>
        </div>
      </section>
      </div>

      <section className="card" aria-labelledby="moons-title">
        <div className="card-head">
          <h2 id="moons-title"><Users size={18}/>Moons</h2>
          <div className="tools">
            <button type="button" disabled={busy || !used.length} onClick={() => open('reset', {ships: used, used: true})}><RotateCcw size={15}/>Reset used moons ({used.length})</button>
            <button type="button" disabled={busy || !pool.length} onClick={() => open('reset', {ships: pool.map(r => r.ship), all: true})}><RotateCcw size={15}/>Reset fleet</button>
          </div>
        </div>
        {pool.length > 0 && <div className="metrics">
          <span><b>{count('free')}</b> free</span><span><b>{count('in-use') + count('link-sent')}</b> with visitors</span>
          <span><b>{count('resetting') + count('catching')}</b> getting ready</span><span><b>{rows.length - count('free') - count('in-use') - count('link-sent') - count('resetting') - count('catching')}</b> need attention</span>
        </div>}
        {pool.length ? <div className="table-wrap"><table>
          <thead><tr><th>Moon</th><th className="status-col">Status</th><th className="actions-head">Actions</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.ship}>
            <td><ShipIdentity ship={row.ship} profile={profileOf(row.ship)} origin={avatarOrigin(row.ship)} edit={editable(row.ship) ? () => openProfile(row.ship) : null} disabled={busy}/><div className="mobile-status">{statusView(row.status)}</div></td>
            <td className="status-col">{statusView(row.status)}</td>
            <td><div className="row-actions">
              <IconButton label={`Reset ${row.ship}`} disabled={busy} onClick={() => open('reset', {ships: [row.ship]})}><RotateCcw size={16}/></IconButton>
              {row.claim && <IconButton label={`Free ${row.ship} as it is`} disabled={busy} onClick={() => open('release', {ships: [row.ship]})}><Unlock size={16}/></IconButton>}
              <IconButton label={`Remove ${row.ship} from the pool`} disabled={busy} onClick={() => open('remove', {ships: [row.ship]})}><Trash2 size={16}/></IconButton>
            </div></td>
          </tr>)}</tbody>
        </table></div> : <p className="muted">The pool is empty.</p>}
      </section>

      <section className="card" aria-labelledby="settings-title">
        <h2 id="settings-title"><Settings size={18}/>Settings</h2>
        <form className="settings" onSubmit={saveSettings}>
          <label>Public address<input aria-label="Public address" value={settings.base} placeholder="203-0-113-7.nip.io" spellCheck="false" onChange={e => {editedSettings.current = true; setSettings({...settings, base: e.target.value});}}/>
            <small>Visitors use join.&lt;address&gt;, and each moon gets &lt;moon&gt;.&lt;address&gt;. With nip.io, it is your public IP with dashes.</small></label>
          <label>Landing page<input aria-label="Landing page" value={settings.landing} placeholder="/apps/glurff/" spellCheck="false" onChange={e => {editedSettings.current = true; setSettings({...settings, landing: e.target.value});}}/>
            <small>Where visitors arrive on their moon.</small></label>
          <div className="tools"><button className="primary" type="submit" disabled={busy}>Save settings</button></div>
        </form>
      </section>

      <FrontDoor manor={manor} notify={text => {setError(''); setNotice(text);}} fail={setError}/>

      <section className="card" aria-labelledby="log-title">
        <h2 id="log-title"><History size={18}/>Activity</h2>
        {manor.log.length ? <ul className="log">{manor.log.map((entry, i) => <li key={`${entry.at}-${i}`}><span className="muted">{day(entry.at)}</span>{entry.text}</li>)}</ul> : <p className="muted">Nothing yet.</p>}
      </section>
    </>}
    </div>

    {modal && <Dialog close={() => setModal(null)} busy={busy} title={{connect: 'Connect a fleet', reset: modal.value?.used ? 'Reset used moons' : modal.value?.all ? 'Reset all moons' : 'Reset moon', release: 'Free moon', remove: 'Remove moon', profile: `Name and picture of ${modal.value?.ship}`}[modal.type]}>
      <form onSubmit={confirm}>
        {modal.type === 'connect' && <>
          <label>Fleet<select aria-label="Fleet" value={form.fleet || ''} onChange={e => setForm({fleet: e.target.value})}>
            <option value="" disabled>Choose a fleet</option>
            {(theseus.fleets || []).map(f => <option key={f.name} value={f.name}>{f.name} ({plural(f.ships.length, 'moon')})</option>)}
          </select></label>
          {chosenFleet && <label>Reset from<select aria-label="Snapshot" value={form.snapshot || ''} onChange={e => setForm({...form, snapshot: e.target.value})}>
            <option value="" disabled>{choices.length ? 'Choose a snapshot' : 'No snapshot covers this fleet'}</option>
            {choices.map(c => <option key={c.path} value={c.path} disabled={!c.compatible}>{c.path}{Number.isNaN(daMs(c.created)) ? '' : ` · ${day(daMs(c.created))}`}{c.compatible ? '' : ' · runtime mismatch'}</option>)}
          </select></label>}
          {chosenFleet && !choices.length && <p className="hint">Take a fleet snapshot of {chosenFleet.name} in Theseus first, once its moons are ready: it is what each moon goes back to after a visitor.</p>}
          <p className="hint">The pool becomes this fleet's moons, each reset from the snapshot. Visitors' claims on other moons are dropped.</p>
        </>}
        {modal.type === 'reset' && <p>Reset {modal.value.ships.length === 1 ? <strong>{modal.value.ships[0]}</strong> : plural(modal.value.ships.length, 'moon')} to {modal.value.ships.length === 1 ? 'its' : 'their'} clean snapshot? Visitors lose {modal.value.ships.length === 1 ? 'it' : 'them'} and everything they did. Each moon goes out again once Theseus has restored it and it is ready.</p>}
        {modal.type === 'release' && <p>Free <strong>{modal.value.ships[0]}</strong> without resetting it? The next visitor gets it as it is, and whoever had it can still get in.</p>}
        {modal.type === 'profile' && <>
          <div className="profile-preview">{form.picture ? <img className="avatar" src={form.picture.url} alt="" style={{width: 64, height: 64}}/> : <ShipAvatar ship={modal.value.ship} size={64} origin={avatarOrigin(modal.value.ship)} profile={{avatar: form.clearAvatar ? null : form.avatar?.trim() ? {type: 'external', url: form.avatar.trim()} : modal.value.avatar}}/>}<ShipName ship={modal.value.ship} profile={{name: form.name}}/></div>
          <label>Name<input autoFocus aria-label="Name" value={form.name} maxLength={80} placeholder={modal.value.ship} onChange={e => setForm({...form, name: e.target.value})}/></label>
          <div className="picture-field"><span className="field-label">Picture</span>
            <div className="picture-actions">
              <label className="file-button"><ImageUp size={16}/>{form.picture ? 'Choose another file' : 'Choose a file'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-label="Picture file" onChange={pickPicture}/></label>
              {(form.picture || ((modal.value.avatar || form.avatar) && !form.clearAvatar)) && <button type="button" className="link-button" onClick={() => setForm({...form, picture: null, avatar: '', clearAvatar: true})}>Remove picture</button>}
            </div>
            {form.picture && <p className="muted">{form.picture.name}, as a {form.picture.width}×{form.picture.height} JPEG</p>}
          </div>
          <label>Or a picture address<input aria-label="Picture address" value={form.avatar} placeholder={modal.value.avatar?.type === 'urbit' && !form.picture ? 'Uploaded in Noltbook; paste an address to replace it' : 'https://...'} spellCheck="false" onChange={e => setForm({...form, avatar: e.target.value, picture: null, clearAvatar: false})}/></label>
          <p className="hint">Saved to the Noltbook profile of {modal.value.ship}, so Noltbook and Glurff show it too.{modal.value.paused ? ' This moon is paused: a new name applies when it resumes, and a new picture needs it running.' : ''}</p>
        </>}
        {modal.type === 'remove' && <p>Take <strong>{modal.value.ships[0]}</strong> out of the pool? The moon itself keeps running in Theseus.</p>}
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="dialog-actions"><button type="button" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
          <button type="submit" className={['connect', 'profile'].includes(modal.type) ? 'primary' : 'danger'} disabled={busy || (modal.type === 'connect' && (!form.fleet || !form.snapshot))}>{busy ? 'Waiting...' : {connect: 'Connect', reset: 'Reset', release: 'Free', remove: 'Remove', profile: 'Save'}[modal.type]}</button></div>
      </form>
    </Dialog>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
