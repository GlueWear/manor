import React, {useEffect, useRef, useState} from 'react';
import {ArrowUpCircle, Check, Network, RefreshCw, Server, Settings, Trash2, Unlock, X} from 'lucide-react';
import {appConfigProblem, externalAvatarProblem, managedEndpoint, managedRemovalKind, managedShipStatus} from './model.mjs';
import {AppFields, appForm, configValue} from './AppFields';

export function ManagedDialog({title, busy, close, children}) {
  const ref = useRef();
  useEffect(() => {ref.current.showModal();}, []);
  return <dialog ref={ref} aria-labelledby="managed-dialog-title" onCancel={e => {e.preventDefault(); if (!busy) close();}}>
    <header><h2 id="managed-dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" title="Close dialog" disabled={busy} onClick={close}><X size={18}/></button></header>
    {children}
  </dialog>;
}

const avatarUrl = avatar => typeof avatar === 'string' ? avatar : avatar?.type === 'external' ? avatar.url : '';
const connectionOf = endpoint => ({mode: endpoint ? endpoint.secure ? 'https' : 'tunnel' : 'local', host: endpoint?.host || '', port: String(endpoint?.port || 443)});
function ConnectionFields({value, onChange}) {
  return <>
    <label>Connection<select aria-label="Connection" value={value.mode} onChange={e => onChange({mode: e.target.value, host: e.target.value === 'tunnel' ? '127.0.0.1' : '', port: e.target.value === 'https' ? '443' : '8101'})}>
      <option value="local">Reported local port</option><option value="https">Remote HTTPS</option><option value="tunnel">Loopback HTTP tunnel</option>
    </select></label>
    {value.mode !== 'local' && <><label>Endpoint host<input aria-label="Endpoint host" value={value.host} spellCheck="false" placeholder={value.mode === 'https' ? 'ship.example.com' : '127.0.0.1'} onChange={e => onChange({...value, host: e.target.value})}/></label>
      <label>Endpoint port<input aria-label="Endpoint port" type="number" min="1" max="65535" value={value.port} onChange={e => onChange({...value, port: e.target.value})}/></label></>}
  </>;
}
export default function ManagedShips({manor, busy, run, Identity}) {
  const ships = manor.managed?.ships || [];
  const requests = manor.pairRequests || [];
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  if (!manor.managed) return null;
  const modalRow = modal && ships.find(row => row.ship === modal.row.ship);
  const modalRequest = modal && requests.find(row => row.ship === modal.row.ship && row.at === modal.row.at);
  const unavailable = modal?.kind === 'ship-approve'
    ? !modalRequest || modalRow?.claim || modalRow?.pending
    : !modalRow || (modal?.kind !== 'ship-forget' && (modalRow.pending || (['ship-profile', 'ship-unlock'].includes(modal?.kind) && !modalRow.online) || (['endpoint', 'ship-configure', 'ship-upgrade', 'ship-remove'].includes(modal?.kind) && modalRow.claim)));
  const command = (kind, value) => {setError(''); return run({[kind]: value}, '', 'The host refused the managed-ship request.', setError);};
  function open(kind, row) {
    setError(''); setModal({kind, row});
    setForm(['endpoint', 'ship-approve'].includes(kind) ? connectionOf(ships.find(ship => ship.ship === row.ship)?.endpoint) : kind === 'ship-profile' ? {name: row.profile?.displayName || '', avatar: avatarUrl(row.profile?.avatar) || ''} : appForm(row));
  }
  function endpointFor(value, ship) {
    const endpoint = value.mode === 'local' ? null : {host: value.host.trim(), port: Number(value.port), secure: value.mode === 'https'};
    const existing = ships.find(row => row.ship === ship);
    if (endpoint || existing?.port) {
      const normalized = managedEndpoint({endpoint, port: existing?.port});
      const duplicate = ships.some(row => {
        try {return row.ship !== ship && managedEndpoint(row).key === normalized.key;} catch {return false;}
      });
      if (duplicate || `127.0.0.1:${manor.eyre}` === normalized.key) throw new Error('Each ship needs a unique effective endpoint.');
      if (endpoint) endpoint.host = normalized.host;
    }
    return endpoint;
  }
  async function submit(e) {
    e.preventDefault(); setError('');
    // A live fact can change availability while a dialog is open.
    if (busy || unavailable) return setError('The ship or request is no longer available for this change.');
    let value = {who: modal.row.ship};
    if (modal.kind === 'ship-profile') {
      const name = form.name.trim(), avatar = form.avatar.trim();
      if (avatar && externalAvatarProblem(avatar)) return setError(externalAvatarProblem(avatar));
      if (name !== (modal.row.profile?.displayName || '')) value.name = name || null;
      if (avatar !== (avatarUrl(modal.row.profile?.avatar) || '')) value.avatar = avatar || null;
      if (Object.keys(value).length === 1) {setModal(null); return;}
    } else if (modal.kind === 'ship-configure') {
      const config = configValue(form), problem = appConfigProblem(config);
      if (problem) return setError(problem);
      value = {...value, ...config};
    } else if (['endpoint', 'ship-approve'].includes(modal.kind)) {
      try {value.endpoint = endpointFor(form, modal.row.ship);} catch (err) {return setError(err.message);}
    }
    if (await command(modal.kind === 'endpoint' ? 'ship-add' : modal.kind, value)) setModal(null);
  }
  const button = (label, icon, action, disabled = false) => <button type="button" className="icon-button" aria-label={label} title={label} disabled={busy || disabled} onClick={action}>{icon}</button>;
  return <section className="card managed-pool" aria-labelledby="managed-title">
    <div className="card-head"><h2 id="managed-title"><Server size={18}/>Ships <span className="muted">{ships.length}</span></h2></div>
    <div className="connection-requests" role="region" aria-labelledby="requests-title">
      <h3 id="requests-title">Connection requests <span className="muted">{requests.length}</span></h3>
      {requests.length ? <ul className="request-list">{requests.map(request => {
        const existing = ships.find(row => row.ship === request.ship);
        return <li key={request.ship}>
          <div className="request-identity"><Identity ship={request.ship}/><time className="muted" dateTime={new Date(request.at).toISOString()}>{new Date(request.at).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}</time></div>
          <div className="row-actions">
            {button(`Approve ${request.ship}`, <Check size={17}/>, () => open('ship-approve', request), !!existing?.claim || !!existing?.pending)}
            {button(`Reject ${request.ship}`, <X size={17}/>, () => command('ship-reject', {who: request.ship}))}
          </div>
        </li>;
      })}</ul> : <p className="muted">No connection requests.</p>}
    </div>
    {error && !modal && <p className="form-error" role="alert">{error}</p>}
    {ships.length ? <div className="table-wrap"><table>
      <thead><tr><th>Ship</th><th className="status-col">Status</th><th className="actions-head">Actions</th></tr></thead>
      <tbody>{ships.map(row => {
        const status = managedShipStatus(row);
        const address = row.endpoint ? `${row.endpoint.secure ? 'https' : 'http'}://${row.endpoint.host}:${row.endpoint.port}` : row.port ? `127.0.0.1:${row.port}` : 'Awaiting web port';
        return <tr key={row.ship}>
          <td><Identity ship={row.ship} profile={{name: row.profile?.displayName, avatar: row.profile?.avatar}} edit={() => open('ship-profile', row)} disabled={busy || !!row.pending || !row.online}/>
            <small className="managed-port">Landing: {row.landing || 'Awaiting status'}</small>
            <small className="managed-port">{address}</small>
            <div className="mobile-status"><span className={`badge ${status.tone}`} title={status.detail}>{status.label}</span></div>
            {row.fault && <small className="managed-fault">{row.fault}</small>}
          </td>
          <td className="status-col"><span className={`badge ${status.tone}`} title={status.detail}><i/>{status.label}</span></td>
          <td><div className="row-actions">
            {button(`Reconnect ${row.ship}`, <RefreshCw size={16}/>, () => command('ship-reconnect', {who: row.ship}), !!row.pending)}
            {button(`Unlock ${row.ship}`, <Unlock size={16}/>, () => open('ship-unlock', row), !!row.pending || !row.online)}
            {button(`Landing app for ${row.ship}`, <Settings size={16}/>, () => open('ship-configure', row), !!row.pending || !!row.claim || !row.online)}
            {button(`Edit endpoint ${row.ship}`, <Network size={16}/>, () => open('endpoint', row), !!row.pending || !!row.claim)}
            {row.transport === 'manor-moon' && button(`Upgrade ${row.ship}`, <ArrowUpCircle size={16}/>, () => open('ship-upgrade', row), !!row.pending || !!row.claim)}
            {button(`${managedRemovalKind(row) === 'ship-forget' ? 'Forget' : 'Remove'} ship ${row.ship}`, <Trash2 size={16}/>, () => open(managedRemovalKind(row), row))}
          </div></td>
        </tr>;
      })}</tbody>
    </table></div> : <p className="muted">No managed ships connected.</p>}
    {modal && <ManagedDialog title={{endpoint: `Endpoint of ${modal.row.ship}`, 'ship-approve': 'Approve ship', 'ship-forget': 'Forget ship', 'ship-unlock': 'Unlock ship', 'ship-remove': 'Remove ship', 'ship-upgrade': 'Upgrade transport', 'ship-profile': `Name and picture of ${modal.row.ship}`, 'ship-configure': `Landing app for ${modal.row.ship}`}[modal.kind]} busy={busy} close={() => {setModal(null); setError('');}}>
      <form onSubmit={submit}>
        {modal.kind === 'ship-approve' && <div className="profile-preview"><Identity ship={modal.row.ship}/></div>}
        {modal.kind === 'ship-unlock' && <p>Sign every browser out of <strong>{modal.row.ship}</strong> and make it available again? Its apps, files and networking keys stay unchanged.</p>}
        {modal.kind === 'ship-remove' && <p>Remove <strong>{modal.row.ship}</strong> from this pool? Its Urbit process stays running.</p>}
        {modal.kind === 'ship-forget' && <p>Forget <strong>{modal.row.ship}</strong> on this controller? This removes only its local registration and reservation. <strong>This does not revoke sessions or stop or delete the actual ship.</strong></p>}
        {modal.kind === 'ship-upgrade' && <p>Switch <strong>{modal.row.ship}</strong> from the legacy transport to %manor? The ship must have %manor installed and paired to this controller.</p>}
        {modal.kind === 'ship-profile' && <>
          <div className="profile-preview"><Identity ship={modal.row.ship} profile={{name: form.name, avatar: form.avatar && !externalAvatarProblem(form.avatar) ? {type: 'external', url: form.avatar} : null}}/></div>
          <label>Name<input autoFocus aria-label="Name" value={form.name} maxLength={80} onChange={e => setForm({...form, name: e.target.value})}/></label>
          <label>Picture address<input aria-label="Picture address" value={form.avatar} placeholder="https://..." spellCheck="false" onChange={e => setForm({...form, avatar: e.target.value})}/></label>
        </>}
        {modal.kind === 'ship-configure' && <AppFields form={form} setForm={setForm} apps={modalRow?.apps}/>}
        {['endpoint', 'ship-approve'].includes(modal.kind) && <ConnectionFields value={form} onChange={setForm}/>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {modal.kind === 'ship-remove' && <div className="forget-option"><button type="button" className="link-button" disabled={busy || !modalRow} onClick={() => open('ship-forget', modalRow)}>Forget locally instead</button></div>}
        <div className="dialog-actions"><button type="button" disabled={busy} onClick={() => {setModal(null); setError('');}}>Cancel</button>
          <button type="submit" className={['endpoint', 'ship-approve', 'ship-profile', 'ship-configure', 'ship-upgrade'].includes(modal.kind) ? 'primary' : 'danger'} disabled={busy || !!unavailable}>{busy ? 'Requesting...' : {endpoint: 'Save', 'ship-approve': 'Approve', 'ship-forget': 'Forget ship', 'ship-unlock': 'Unlock', 'ship-remove': 'Remove', 'ship-upgrade': 'Upgrade', 'ship-profile': 'Save', 'ship-configure': 'Save'}[modal.kind]}</button>
        </div>
      </form>
    </ManagedDialog>}
  </section>;
}
