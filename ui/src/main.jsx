import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AlertCircle, ArrowUpRight, Check, Folder, History, ImageUp, LoaderCircle, Pencil, RotateCcw, Trash2, Unlock, Users, X} from 'lucide-react';
import '@urbit/sigil-js';
import {act, gateway, manorState, profiles as fetchProfiles, setProfile, theseusState, watchManor, watchProfiles, watchUi, SignedOut} from './api';
import {avatarSrc, daMs, moonOrigin, moonStatus, resetProgress, snapshotChoices, usedMoons} from './model.mjs';
import './style.css';
import ManagedShips from './ManagedShips';
import ThisShip from './ThisShip';
import PublicAccess from './PublicAccess';

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
  const [profileData, setProfileData] = useState(null);
  const [gw, setGw] = useState(undefined);
  const [resetRun, setResetRun] = useState(null);
  const mounted = useRef(true);

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
      const [m, t] = await Promise.all([manorState(), theseusState().catch(() => null)]);
      if (!mounted.current) return;
      setManor(m); setTheseus(t); setSignedOut(false); setLoadError(''); setNow(Date.now());
      watchManor(scheduleRefresh).catch(() => retryIn(5000));
      if (t) {
        watchUi(scheduleRefresh).catch(() => retryIn(5000));
        watchProfiles(applyProfile).catch(() => retryIn(5000));
      }
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
    if (!manor || !theseus || profileData) return;
    loadProfiles();
    gateway().then(g => mounted.current && setGw(g)).catch(() => mounted.current && setGw(null));
  }, [manor, theseus]);

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

  const host = manor?.host || theseus?.host;
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

  const choices = modal?.type === 'connect' ? snapshotChoices((theseus?.fleets || []).find(f => f.name === form.fleet), theseus?.snapshots || []) : [];
  const chosenFleet = modal?.type === 'connect' && (theseus?.fleets || []).find(f => f.name === form.fleet);

  return <div className="page">
    <header className="top">
      <div className="top-inner">
        <div className="brand"><img src="/apps/manor/icon.png" alt="" className="brand-icon"/><div><span className="brand-kicker">SHIP HOSTING</span><h1>Manor</h1><span className="brand-subtitle">{host ? `Visitor pool on ${host}` : 'Visitor pool'}</span></div></div>
        {theseus && <a className="out-link" href="/apps/theseus/">Open Theseus <ArrowUpRight size={14}/></a>}
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
      <ManagedShips manor={manor} busy={busy} run={run} Identity={ShipIdentity}/>
      <PublicAccess manor={manor} theseus={theseus} busy={busy} run={run} notify={text => {setError(''); setNotice(text);}} fail={setError}/>
      {!theseus && <section className="card" aria-labelledby="theseus-title">
        <div className="card-head"><h2 id="theseus-title"><Folder size={18}/>Theseus fleet</h2><span className="badge warn">Unavailable</span></div>
        <div className="fleet-row"><p className="muted">{fleet ? `${fleet.name} · ${pool.length} virtual moons` : 'No virtual fleet connected.'}</p><button type="button" disabled title="Theseus is not running">Connect a fleet</button></div>
      </section>}
      {theseus && <>
      <section className="card" aria-labelledby="fleet-title">
        <h2 id="fleet-title"><Folder size={18}/>Theseus fleet</h2>
        <div className="fleet-row">
          {fleet ? <p><strong>{fleet.name}</strong> <span className="muted">· {plural(pool.length, 'moon')}, reset from {fleet.snapshot}</span></p>
            : <p className="muted">No fleet connected. Boot one in Theseus, take a fleet snapshot, then connect it here.</p>}
          <button type="button" className={fleet ? '' : 'primary'} disabled={busy || !theseus} onClick={() => open('connect')}>{fleet ? 'Change fleet' : 'Connect a fleet'}</button>
        </div>
      </section>

      <section className="card" aria-labelledby="moons-title">
        <div className="card-head">
          <h2 id="moons-title"><Users size={18}/>Virtual moons</h2>
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
      </>}

      <ThisShip manor={manor} busy={busy} run={run} Identity={ShipIdentity}/>

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
