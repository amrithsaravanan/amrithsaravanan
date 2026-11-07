import { useRef } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { PageHeader, useUI } from '../components/ui';
import { saveSettings, useSettings } from '../lib/settings';
import { clearAll, exportAll, exportBanks, restoreBackup } from '../lib/backup';
import type { ExamMode } from '../types';

export default function SettingsPage() {
  const s = useSettings();
  const ui = useUI();
  const file = useRef<HTMLInputElement>(null);

  const restore = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      if (!(await ui.confirm({ title: 'Restore backup?', confirmLabel: 'Restore', body: <p>Records in the backup overwrite local records with the same ID. Other local data is kept.</p> }))) return;
      const n = await restoreBackup(raw);
      ui.toast(`Restored ${n.banks} question bank(s) and ${n.results} result(s)`, 'success');
    } catch (e) { ui.toast(`Restore failed: ${(e as Error).message}`, 'error'); }
  };
  const clear = async () => {
    if (!(await ui.confirm({ title: 'Clear all local data?', danger: true, confirmLabel: 'Clear everything',
      body: <p>This permanently deletes every question bank, test history, in-progress test and setting stored on this device. Export a backup first if you may need it.</p> }))) return;
    await clearAll(); localStorage.removeItem('examlab-theme'); ui.toast('All local data cleared', 'success');
  };

  return (
    <>
      <PageHeader title="Settings" />
      <div className="stack">
        <div className="card"><h2>Appearance</h2>
          <div className="seg" style={{ maxWidth: 420 }}>
            {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]] as const).map(([k, l, I]) => (
              <button key={k} className={s.theme === k ? 'on' : ''} onClick={() => saveSettings({ theme: k })}><I size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{l}</button>))}
          </div></div>

        <div className="card"><h2>Examination</h2>
          <div className="form-grid">
            <div className="field"><label className="label">Default duration (minutes)</label>
              <input type="number" min={1} placeholder="Use the bank's duration" value={s.defaultDurationMinutes ?? ''} onChange={(e) => saveSettings({ defaultDurationMinutes: e.target.value ? Math.max(1, Number(e.target.value)) : null })} /></div>
            <div className="field"><label className="label">Default examination mode</label>
              <select value={s.defaultMode} onChange={(e) => saveSettings({ defaultMode: e.target.value as ExamMode })}>
                <option value="practice">Practice</option><option value="standard">Standard exam</option><option value="strict">Strict exam</option></select></div>
          </div>
          <div className="row gap wrap mt-s">
            <label className="check"><input type="checkbox" checked={s.shuffleQuestions} onChange={(e) => saveSettings({ shuffleQuestions: e.target.checked })} /> Shuffle questions by default</label>
            <label className="check"><input type="checkbox" checked={s.shuffleOptions} onChange={(e) => saveSettings({ shuffleOptions: e.target.checked })} /> Shuffle options by default</label>
          </div></div>

        <div className="card"><h2>Monitoring</h2>
          <div className="stack" style={{ gap: 12 }}>
            <label className="check"><input type="checkbox" checked={s.monitoringEnabled} onChange={(e) => saveSettings({ monitoringEnabled: e.target.checked })} /> Enable monitoring in Standard and Strict modes</label>
            <label className="check"><input type="checkbox" checked={s.countFocusLoss} onChange={(e) => saveSettings({ countFocusLoss: e.target.checked })} />
              <span>Count window focus loss as a violation<br /><span className="caption">Covers switching to another window without the tab being hidden. It is recorded as unconfirmed either way.</span></span></label>
            <div className="field" style={{ maxWidth: 280 }}><label className="label">Warnings before auto-submit (Strict mode)</label>
              <input type="number" min={1} max={20} value={s.threshold} onChange={(e) => saveSettings({ threshold: Math.min(20, Math.max(1, Number(e.target.value) || 3)) })} />
              <span className="caption">With 3, violations 1–3 show warnings and the 4th submits the exam. Standard mode never auto-submits. Practice mode has no monitoring.</span></div>
            <p className="caption">Monitoring uses browser events only. It cannot see other apps or sites and no data leaves this device. Applies to tests created after the change.</p>
          </div></div>

        <div className="card"><h2>Data</h2>
          <div className="row gap wrap">
            <button className="btn" onClick={exportAll}>Export all local data</button>
            <button className="btn" onClick={() => file.current?.click()}>Restore backup</button>
            <button className="btn" onClick={exportBanks}>Export question banks</button>
            <button className="btn btn-danger" onClick={clear}>Clear local data</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
          </div></div>
      </div>
    </>
  );
}
