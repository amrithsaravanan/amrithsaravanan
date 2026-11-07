import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Empty, PageHeader, useUI } from '../components/ui';
import { useSettings } from '../lib/settings';
import { buildSession, KIND_LABEL, poolFor } from '../lib/exam';
import type { ExamMode, TestKind } from '../types';

const MODE_HELP: Record<ExamMode, string> = {
  practice: 'Instant answer feedback. Monitoring is off and there are no violation penalties.',
  standard: 'Monitoring on. Violations are recorded and warned about, but never end the test automatically.',
  strict: 'Monitoring on. Exceeding the warning limit submits the examination automatically.',
};

export default function Configure() {
  const banks = useLiveQuery(() => db.banks.where('status').notEqual('archived').toArray(), []);
  const settings = useSettings();
  const nav = useNavigate();
  const ui = useUI();

  const [bankId, setBankId] = useState('');
  const [kind, setKind] = useState<TestKind>('full');
  const [section, setSection] = useState('');
  const [count, setCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [touched, setTouched] = useState(false);
  const [marks, setMarks] = useState('');
  const [neg, setNeg] = useState('');
  const [shQ, setShQ] = useState(settings.shuffleQuestions);
  const [shO, setShO] = useState(settings.shuffleOptions);
  const [mode, setMode] = useState<ExamMode>(settings.defaultMode);

  const subjects = useMemo(() => [...new Set((banks ?? []).map((b) => b.subject))], [banks]);
  const [subject, setSubject] = useState('');
  const visible = (banks ?? []).filter((b) => !subject || b.subject === subject);
  const bank = (banks ?? []).find((b) => b.id === bankId);

  useEffect(() => { // default selection
    if (!banks || bankId) return;
    const a = banks.find((b) => b.status === 'active') ?? banks[0];
    if (a) setBankId(a.id);
  }, [banks, bankId]);
  useEffect(() => { setShQ(settings.shuffleQuestions); setShO(settings.shuffleOptions); setMode(settings.defaultMode); }, [settings.shuffleQuestions, settings.shuffleOptions, settings.defaultMode]);

  const pool = bank ? poolFor(bank, kind, section || undefined).length : 0;
  useEffect(() => { if (kind === 'section' && !section && bank) setSection(bank.sections[0]); }, [kind, section, bank]);
  useEffect(() => { setSection(''); }, [bankId]);
  useEffect(() => { if (kind === 'custom') setCount((c) => Math.min(Math.max(c || Math.min(10, pool), 1), Math.max(pool, 1))); else setCount(pool); }, [kind, pool]);
  useEffect(() => {
    if (!bank || touched) return;
    const base = settings.defaultDurationMinutes ?? bank.durationMinutes;
    setDuration(kind === 'full' ? base : Math.max(1, Math.round((base * (count || 1)) / (bank.questions.length || 1))));
  }, [bank, kind, count, touched, settings.defaultDurationMinutes]);

  if (!banks) return null;
  if (banks.length === 0) return (<><PageHeader title="Test Configuration" /><Empty title="No question bank available" text="Import a question bank before starting a test." action={<Link className="btn btn-primary" to="/import">Import Questions</Link>} /></>);

  const effCount = kind === 'full' ? pool : count;
  const problem = !bank ? 'Select a question bank.' : pool === 0 ? 'No questions available for this selection.'
    : effCount < 1 || effCount > pool ? `Choose between 1 and ${pool} questions.` : duration < 1 ? 'Duration must be at least 1 minute.' : '';

  const start = async () => {
    if (!bank || problem) return;
    const { session, keys } = buildSession({
      bank, kind, section: kind === 'full' ? undefined : section || undefined, count: effCount, durationMin: duration,
      marksOverride: marks === '' ? null : Math.max(0.01, Number(marks)), negativeOverride: neg === '' ? null : Math.max(0, Number(neg)),
      shuffleQuestions: shQ, shuffleOptions: shO, mode,
    }, settings);
    try {
      await db.transaction('rw', db.sessions, db.keys, async () => { await db.sessions.add(session); await db.keys.add({ sessionId: session.id, items: keys }); });
      nav(`/exam/${session.id}`);
    } catch (e) { ui.toast(`Could not create test: ${(e as Error).message}`, 'error'); }
  };

  return (
    <>
      <PageHeader title="Test Configuration" sub="Choose what to be examined on and how the examination runs." />
      <div className="card stack">
        <div className="form-grid">
          <div className="field"><label className="label">Subject</label>
            <select value={subject} onChange={(e) => { setSubject(e.target.value); setBankId(''); }}>
              <option value="">All subjects</option>{subjects.map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div className="field"><label className="label">Question bank</label>
            <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {visible.map((b) => <option key={b.id} value={b.id}>{b.title}{b.status === 'active' ? ' (active)' : ''} — {b.questions.length} Q</option>)}
            </select></div>
        </div>

        <div className="field"><label className="label">Test type</label>
          <div className="seg">{(['full', 'section', 'custom'] as TestKind[]).map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setTouched(false); }}>{KIND_LABEL[k]}</button>))}</div>
          <span className="caption">{kind === 'full' ? 'All questions in the bank.' : kind === 'section' ? 'All questions from one section.' : 'A random selection of unique questions.'}</span></div>

        <div className="form-grid">
          {kind !== 'full' && bank && (
            <div className="field"><label className="label">Section</label>
              <select value={section} onChange={(e) => { setSection(e.target.value); setTouched(false); }}>
                {kind === 'custom' && <option value="">All sections</option>}
                {bank.sections.map((s) => <option key={s}>{s}</option>)}
              </select></div>)}
          <div className="field"><label className="label">Number of questions</label>
            <input type="number" min={1} max={pool} disabled={kind !== 'custom'} value={effCount} onChange={(e) => { setCount(Number(e.target.value)); setTouched(false); }} />
            <span className="caption">{pool} available</span></div>
          <div className="field"><label className="label">Duration (minutes)</label>
            <input type="number" min={1} value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setTouched(true); }} /></div>
          <div className="field"><label className="label">Marks per question (optional)</label>
            <input type="number" min={0} step="0.25" placeholder="Use bank values" value={marks} onChange={(e) => setMarks(e.target.value)} /></div>
          <div className="field"><label className="label">Negative marks per wrong answer (optional)</label>
            <input type="number" min={0} step="0.25" placeholder="Use bank values" value={neg} onChange={(e) => setNeg(e.target.value)} /></div>
        </div>

        <div className="row gap wrap">
          <label className="check"><input type="checkbox" checked={shQ} onChange={(e) => setShQ(e.target.checked)} /> Shuffle questions (within each section)</label>
          <label className="check"><input type="checkbox" checked={shO} onChange={(e) => setShO(e.target.checked)} /> Shuffle options</label>
        </div>

        <div className="field"><label className="label">Examination mode</label>
          <div className="seg">{(['practice', 'standard', 'strict'] as ExamMode[]).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'practice' ? 'Practice' : m === 'standard' ? 'Standard exam' : 'Strict exam'}</button>))}</div>
          <span className="caption">{MODE_HELP[mode]}{mode !== 'practice' && !settings.monitoringEnabled ? ' (Monitoring is disabled in Settings.)' : ''}</span></div>

        {problem && <div className="banner warn">{problem}</div>}
        <div className="row gap"><button className="btn btn-primary" disabled={!!problem} onClick={start}>Continue to instructions</button></div>
      </div>
    </>
  );
}
