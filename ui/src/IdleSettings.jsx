import React, {useState} from 'react';

export default function IdleSettings({minutes = 0, busy, run, fail}) {
  const [draft, setDraft] = useState(null);
  const enabled = draft ? draft.enabled : minutes > 0;
  const limit = draft ? draft.limit : minutes || 15;
  function change(values) {setDraft({enabled, limit, ...values});}
  async function save(event) {
    event.preventDefault();
    if (enabled && (!Number.isInteger(limit) || limit < 2 || limit > 1440)) {fail('Use an idle limit from 2 to 1440 minutes.'); return;}
    if (await run({'idle-policy': {minutes: enabled ? limit : 0}}, 'Idle timeout saved.', 'The ship refused this timeout.')) setDraft(null);
  }
  return <form className="idle-settings" onSubmit={save} aria-label="Visitor idle timeout">
    <label className="check"><input type="checkbox" checked={enabled} onChange={e => change({enabled: e.target.checked})}/>Auto-unlock idle visitors</label>
    <div className="front-fields">
      <label>Idle limit (minutes)<input aria-label="Idle limit (minutes)" type="number" min="2" max="1440" step="1" value={limit} disabled={!enabled} onChange={e => change({limit: Number(e.target.value)})}/></label>
      {enabled && <label>Warning<output>1 minute</output></label>}
    </div>
    <button type="submit" disabled={busy || !draft}>Save timeout</button>
  </form>;
}
