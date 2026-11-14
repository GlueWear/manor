import React, {useState} from 'react';
import {Copy, Download, ExternalLink, Globe} from 'lucide-react';
import {baseProblem, caddyfile, FRONT_DEFAULTS, frontProblem, managedCaddyfile, managedLocalCaddyfile, publicLink} from './model.mjs';

const KEY = 'manor.front';
function loadFront() {
  try {return {...FRONT_DEFAULTS, shipPort: 8091, ...JSON.parse(localStorage.getItem(KEY) || '{}')};}
  catch {return {...FRONT_DEFAULTS, shipPort: 8091};}
}

export default function PublicAccess({manor, theseus, busy, run, notify, fail}) {
  const [front, setFront] = useState(loadFront);
  const [base, setBase] = useState(manor.settings.base);
  const [landing, setLanding] = useState(manor.settings.landing);
  const [edited, setEdited] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  const ships = manor.managed?.ships || [];
  const pool = selectedPool || manor.visitorPool || (ships.length || !theseus ? 'ships' : 'theseus');
  const set = value => setFront(current => {
    const next = {...current, ...value};
    try {localStorage.setItem(KEY, JSON.stringify(next));} catch { /* storage may be unavailable */ }
    return next;
  });
  const savedBase = manor.settings.base;
  const shownBase = edited ? base : savedBase;
  const shownLanding = edited ? landing : manor.settings.landing;
  const local = pool === 'ships' && !savedBase;
  let config = '', configError = '';
  try {
    if (pool === 'ships') {
      if (!ships.length) throw new Error('No managed ships connected.');
      config = local
        ? managedLocalCaddyfile({ship: manor.host, eyre: manor.eyre, ships, port: front.shipPort})
        : managedCaddyfile({ship: manor.host, eyre: manor.eyre, ships, base: savedBase, ...front});
    } else {
      const problem = frontProblem(front);
      if (problem) throw new Error(problem);
      if (!savedBase) throw new Error('Save a public address first.');
      config = caddyfile({ship: manor.host, eyre: manor.eyre, base: savedBase, ...front});
    }
  } catch (err) {configError = err.message;}
  const link = local ? `http://join.localhost:${front.shipPort}/` : publicLink(savedBase);
  const inventory = manor.controlled?.apps;
  const fleetDesks = new Set((theseus?.moons || []).flatMap(row => (row.desks || []).map(d => d.desk)));
  const choices = Array.isArray(inventory)
    ? inventory.filter(app => app.web && app.running && (!fleetDesks.size || fleetDesks.has(app.desk)))
    : [...fleetDesks].filter(desk => !['base', 'kids'].includes(desk)).map(desk => ({desk}));
  const options = [...new Set(choices.map(app => `/apps/${app.desk}/`))].sort();
  if (!options.includes(shownLanding)) options.unshift(shownLanding);
  async function save(e) {
    e.preventDefault();
    const nextBase = shownBase.trim().toLowerCase();
    const problem = baseProblem(nextBase);
    if (problem) {fail(problem); return;}
    if (await run({hosting: {base: nextBase, landing: shownLanding, pool}}, 'Hosting settings saved.', 'The ship refused these settings.')) {setEdited(false); setSelectedPool(null);}
  }
  function download() {
    const url = URL.createObjectURL(new Blob([config], {type: 'application/octet-stream'}));
    const a = document.createElement('a'); a.href = url;
    a.download = local ? 'Caddyfile.managed-local' : 'Caddyfile'; a.click(); URL.revokeObjectURL(url);
  }
  async function copy() {
    try {await navigator.clipboard.writeText(config); notify('Copied the Caddyfile.');}
    catch {fail('Could not copy the Caddyfile.');}
  }
  const number = (label, key) => <label>{label}<input aria-label={label} type="number" min={key === 'shipPort' ? 1024 : 1} max="65535" value={front[key]} onChange={e => set({[key]: Number(e.target.value)})}/></label>;
  return <section className="card public-access" aria-labelledby="public-access-title">
    <div className="card-head"><h2 id="public-access-title"><Globe size={18}/>Public access</h2><span className={`badge ${local || edited ? 'warn' : 'ok'}`}>{edited ? 'Unsaved settings' : local ? 'Local test only' : 'Public configuration'}</span></div>
    <label className="pool-selector">Visitor pool<select aria-label="Visitor pool" value={pool} onChange={e => {setSelectedPool(e.target.value); setEdited(true); setBase(shownBase); setLanding(shownLanding);}}>
      <option value="ships">Managed ships</option><option value="theseus">Theseus fleet</option>
    </select></label>
    {local && <p className="access-warning" role="status">No public address saved. This Caddyfile is for local testing.</p>}
    {pool === 'theseus' && !theseus && <p className="access-warning" role="status">Theseus is unavailable. Its saved configuration is retained.</p>}
    <form className="settings access-settings" onSubmit={save}>
      <label>Public address<input aria-label="Public address" value={shownBase} placeholder="example.com" spellCheck="false" onChange={e => {setEdited(true); setBase(e.target.value); setLanding(shownLanding);}}/></label>
      {pool === 'theseus' && <label>Landing app<select aria-label="Fleet landing app" value={shownLanding} onChange={e => {setEdited(true); setBase(shownBase); setLanding(e.target.value);}}>
        {options.map(path => <option key={path} value={path}>{/^\/apps\/[^/]+\/$/.test(path) ? path.split('/')[2] : path}</option>)}
      </select></label>}
      <div className="tools"><button type="submit" className="primary" disabled={busy}>Save settings</button></div>
    </form>
    <div className="access-link"><span className="field-label">{local ? 'Local test address' : 'Public link'}</span>
      {link ? <a className="public-link" href={link} target="_blank" rel="noreferrer">{link}<ExternalLink size={14}/></a> : <span className="muted">No public address saved.</span>}
    </div>
    <div className="tools access-download"><button type="button" className="primary" disabled={!config || edited} onClick={download}><Download size={15}/>Download Caddyfile</button>
      <button type="button" className="icon-button" aria-label="Copy Caddyfile" title="Copy Caddyfile" disabled={!config || edited} onClick={copy}><Copy size={16}/></button>
    </div>
    {configError && <p className={local && !ships.length || !local && !savedBase ? 'muted' : 'form-error'} role={local && !ships.length || !local && !savedBase ? undefined : 'alert'}>{configError}</p>}
    <details className="connection-settings"><summary>Connection settings</summary>
      <div className="front-fields">
        {local ? number('Local test port', 'shipPort') : <>{number('HTTPS port', 'httpsPort')}{number('Test port', 'localPort')}<label>Caddy admin<input aria-label="Caddy admin" value={front.admin} onChange={e => set({admin: e.target.value.trim()})}/></label></>}
      </div>
      {!local && <label className="check"><input type="checkbox" checked={front.staging} onChange={e => set({staging: e.target.checked})}/>Trial certificates</label>}
    </details>
    {config && <details className="config"><summary>Show Caddyfile</summary><pre data-testid="caddyfile">{config}</pre></details>}
  </section>;
}
