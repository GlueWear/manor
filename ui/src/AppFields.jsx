import React from 'react';

export const requiredList = value => Array.isArray(value) ? value : String(value || '').split(',').map(s => s.trim()).filter(Boolean);
export const configValue = form => ({landing: form.landing, required: [...new Set([form.landing, ...requiredList(form.required)])]});
export const appForm = row => ({landing: row.landing || 'landscape', required: row.required || []});

export function AppFields({form, setForm, apps}) {
  const installed = Array.isArray(apps) ? apps : [];
  const choices = installed.filter(app => app.web && app.running).sort((a, b) => a.desk.localeCompare(b.desk));
  const selected = requiredList(form.required);
  const current = choices.some(app => app.desk === form.landing);
  const extras = [...new Set([...installed.map(app => app.desk), ...selected])].filter(desk => desk !== form.landing).sort();
  function choose(landing) {
    setForm({...form, landing, required: [...new Set([landing, ...selected.filter(desk => desk !== form.landing && desk !== landing)])]});
  }
  return <>
    <label>Landing app<select aria-label="Landing app" value={form.landing} disabled={!choices.length} onChange={e => choose(e.target.value)}>
      {!current && <option value={form.landing} disabled={Array.isArray(apps)}>{form.landing} ({Array.isArray(apps) ? 'unavailable' : 'current'})</option>}
      {choices.map(app => <option key={app.desk} value={app.desk}>{app.desk}</option>)}
    </select></label>
    {!Array.isArray(apps) && <p className="muted">App list unavailable.</p>}
    {Array.isArray(apps) && !choices.length && <p className="muted">No running apps with a web page.</p>}
    <details className="readiness-settings"><summary>Advanced readiness checks</summary>
      <fieldset><legend>Also wait for</legend>
        {extras.map(desk => <label className="check" key={desk}><input type="checkbox" checked={selected.includes(desk)} onChange={e => setForm({...form, required: e.target.checked ? [...selected, desk] : selected.filter(item => item !== desk)})}/>{desk}</label>)}
        {!extras.length && <span className="muted">No additional desks.</span>}
      </fieldset>
    </details>
  </>;
}
