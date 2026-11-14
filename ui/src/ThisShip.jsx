import React, {useState} from 'react';
import {Link2, Settings, Unlink} from 'lucide-react';
import {appConfigProblem, normalizeShip, shipProblem} from './model.mjs';
import {ManagedDialog} from './ManagedShips';
import {AppFields, appForm, configValue} from './AppFields';

export default function ThisShip({manor, busy, run, Identity}) {
  const controlled = manor.controlled;
  const [modal, setModal] = useState(null);
  const [controller, setController] = useState('');
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  if (!controlled) return null;
  const working = busy || !!controlled.busy;
  function open(kind) {
    setError(''); setConsent(false); setController(''); setModal(kind);
    setForm(appForm(controlled));
  }
  async function submit(e) {
    e.preventDefault(); setError('');
    if (working) return;
    let action;
    if (modal === 'config') {
      const value = configValue(form), problem = appConfigProblem(value);
      if (problem) return setError(problem);
      action = {'managed-configure': value};
    } else {
      const who = modal === 'unpair' ? null : normalizeShip(controller);
      if (who !== null) {
        const problem = shipProblem(who);
        if (problem) return setError(problem);
        if (who === manor.host) return setError('Choose a controller other than this ship.');
        if (!consent) return setError('Confirm the controller permissions first.');
      }
      action = {pair: {controller: who}};
    }
    if (await run(action, '', 'The host refused this ship configuration.', setError)) setModal(null);
  }
  return <details className="card managed-role">
    <summary>Allow another Manor to manage this ship {controlled.controller && <span className="badge warn">Paired</span>}</summary>
    <section className="this-ship" aria-labelledby="this-ship-title">
    <div className="card-head"><h2 id="this-ship-title"><Link2 size={18}/>This ship: {manor.host}</h2><div className="tools">
      <button type="button" disabled={working} onClick={() => open('config')}><Settings size={15}/>Visitor settings for this ship</button>
      {controlled.controller ? <button type="button" disabled={working} onClick={() => open('unpair')}><Unlink size={15}/>Remove controller</button> : <button type="button" disabled={working} onClick={() => open('pair')}><Link2 size={15}/>Choose controller</button>}
    </div></div>
    <div className="this-ship-detail"><Identity ship={manor.host} profile={{name: controlled.profile?.displayName, avatar: controlled.profile?.avatar}}/>
      <span className={`badge ${controlled.busy ? 'busy' : controlled.ready ? 'ok' : 'warn'}`}>{controlled.busy ? 'working' : controlled.ready ? 'ready' : 'not ready'}</span>
    </div>
    <dl className="ship-config"><div><dt>Managed by</dt><dd>{controlled.controller || 'Not paired'}</dd></div><div><dt>Landing app</dt><dd>{controlled.landing}</dd></div></dl>
    {modal && <ManagedDialog title={modal === 'config' ? `Visitor settings for ${manor.host}` : modal === 'unpair' ? 'Remove controller' : `Allow a controller for ${manor.host}`} busy={working} close={() => setModal(null)}>
      <form onSubmit={submit}>
        {modal === 'config' && <AppFields form={form} setForm={setForm} apps={controlled.apps}/>}
        {modal === 'pair' && <>
          <label>Controller ship<input autoFocus aria-label="Controller ship" value={controller} placeholder="~siglup" spellCheck="false" onChange={e => setController(e.target.value)}/></label>
          <p>This grants the chosen controller access to {manor.host} itself, not to the ships listed above. It can create visitor logins, sign browsers out, and change this ship's profile and visitor settings.</p>
          <p>A connection request will be sent to its owner for approval.</p>
          <label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>I grant these permissions to this controller.</label>
        </>}
        {modal === 'unpair' && <p>Remove <strong>{controlled.controller}</strong> as this ship's controller and stop accepting its requests?</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" disabled={working} onClick={() => setModal(null)}>Cancel</button><button type="submit" className={modal === 'unpair' ? 'danger' : 'primary'} disabled={working || (modal === 'pair' && !consent)}>{modal === 'config' ? 'Save' : modal === 'unpair' ? 'Remove controller' : 'Allow controller'}</button></div>
      </form>
    </ManagedDialog>}
  </section></details>;
}
