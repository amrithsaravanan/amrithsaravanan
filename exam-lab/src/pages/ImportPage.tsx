import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileDown, FileJson, Upload } from 'lucide-react';
import { db } from '../lib/db';
import { PageHeader, useUI } from '../components/ui';
import { BankSummary, QuestionList } from '../components/BankPreview';
import { validateBank, type ValidationReport } from '../lib/validate';
import { addAndActivate, addBank, replaceActive } from '../lib/banks';
import { downloadJSON } from '../lib/util';
import sample from '../data/sample.json';
import template from '../data/template.json';

export default function ImportPage() {
  const [params] = useSearchParams();
  const replaceMode = params.get('mode') === 'replace';
  const nav = useNavigate();
  const ui = useUI();
  const active = useLiveQuery(() => db.banks.where('status').equals('active').first(), []);
  const existing = useLiveQuery(() => db.banks.toArray(), []);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const check = (raw: unknown, name: string) => { setFileName(name); setReport(validateBank(raw)); };
  const handleFile = async (f: File) => {
    try {
      if (f.size > 25 * 1024 * 1024) throw new Error('File is larger than 25 MB.');
      check(JSON.parse(await f.text()), f.name);
    } catch (e) {
      setFileName(f.name);
      setReport({ ok: false, warnings: [], errors: [e instanceof SyntaxError ? `Not valid JSON: ${e.message}` : (e as Error).message] });
    }
  };

  const bank = report?.ok ? report.bank! : null;
  const dupSet = bank && existing?.some((b) => b.setId === bank.setId);

  const doImport = async (kind: 'add' | 'activate') => {
    if (!bank) return;
    setBusy(true);
    try {
      await (kind === 'add' ? addBank(bank) : addAndActivate(bank));
      ui.toast(kind === 'add' ? 'Question bank imported' : 'Question bank imported and activated', 'success');
      nav('/banks');
    } catch (e) { ui.toast(`Import failed: ${(e as Error).message}`, 'error'); } finally { setBusy(false); }
  };

  const doReplace = async () => {
    if (!bank) return;
    const ok = await ui.confirm({
      title: 'Replace active question bank?', confirmLabel: 'Replace Active Question Bank',
      body: (
        <div className="stack">
          <div className="two-col">
            <div className="kv"><span>Current active bank (will be archived)</span><b>{active ? active.title : 'None'}</b><span>{active ? `${active.questions.length} questions` : ''}</span></div>
            <div className="kv"><span>Replacement (will become active)</span><b>{bank.title}</b><span>{bank.questions.length} questions</span></div>
          </div>
          <p className="caption">The banks are never merged. Test history and any in-progress test are not affected, and the archived bank can be restored later.</p>
        </div>),
    });
    if (!ok) return;
    setBusy(true);
    try { await replaceActive(bank); ui.toast('Active question bank replaced', 'success'); nav('/banks'); }
    catch (e) { ui.toast(`Replacement failed, previous bank kept: ${(e as Error).message}`, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title={replaceMode ? 'Replace Active Question Bank' : 'Import Questions'}
        sub={replaceMode ? 'Upload a new JSON file. The current active bank is archived, never merged.' : 'Load a JSON question bank from your device. Nothing leaves your browser.'}
        actions={<>
          <button className="btn" onClick={() => downloadJSON('exam-lab-template.json', template)}><FileDown size={15} /> Blank template</button>
          <button className="btn" onClick={() => downloadJSON('sample-aptitude-set-01.json', sample)}><FileJson size={15} /> Sample file</button>
        </>} />

      {replaceMode && (
        <div className="banner" style={{ marginBottom: 16 }}>
          Current active bank: <b>{active ? `${active.title} (${active.questions.length} questions)` : 'none'}</b>
        </div>
      )}

      <div className={`dropzone${over ? ' over' : ''}`} role="button" tabIndex={0}
        onClick={() => input.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter') input.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
        <Upload size={22} />
        <p style={{ marginTop: 8 }}><b>Select a JSON file</b> or drop it here</p>
        <p className="caption">{fileName || 'Schema version 1.0'}</p>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      </div>
      <p className="caption mt-s">No file handy? <a href="#/import" onClick={(e) => { e.preventDefault(); check(sample, 'sample-aptitude-set-01.json'); }}>Load the built-in sample</a>.</p>

      {report && !report.ok && (
        <div className="banner error mt">
          <b>This file was rejected. Nothing was imported and your existing banks are unchanged.</b>
          <ul>{report.errors.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}</ul>
          {report.errors.length > 30 && <div>…and {report.errors.length - 30} more errors.</div>}
        </div>
      )}

      {bank && report && (
        <div className="stack mt">
          <div className="banner ok">Validation passed for <b>{fileName}</b>.</div>
          {dupSet && <div className="banner warn">A bank with setId “{bank.setId}” already exists. Importing adds a separate copy; nothing is overwritten.</div>}
          {report.warnings.length > 0 && (
            <div className="banner warn"><b>{report.warnings.length} warning(s)</b>
              <ul>{report.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}</ul>
              {report.warnings.length > 8 && <div>…and {report.warnings.length - 8} more.</div>}
            </div>
          )}
          <div className="card">
            <h2>Preview</h2>
            <BankSummary bank={bank} />
            <h3 className="mt">Sample questions</h3>
            <QuestionList bank={bank} limit={3} />
          </div>
          <div className="row gap wrap">
            {replaceMode ? (
              <button className="btn btn-primary" disabled={busy} onClick={doReplace}>Replace Active Question Bank</button>
            ) : (
              <>
                <button className="btn btn-primary" disabled={busy} onClick={() => doImport('activate')}>Import and activate</button>
                <button className="btn" disabled={busy} onClick={() => doImport('add')}>Import to library</button>
                {active && <button className="btn" disabled={busy} onClick={doReplace}>Replace active bank instead</button>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
