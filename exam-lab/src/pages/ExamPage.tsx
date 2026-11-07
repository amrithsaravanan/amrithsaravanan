import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, ChevronLeft, ChevronRight, Eraser, ListChecks, Maximize, Save } from 'lucide-react';
import { db } from '../lib/db';
import { finalizeSession } from '../lib/submit';
import { MODE_LABEL, KIND_LABEL } from '../lib/exam';
import { fmtClock, letter } from '../lib/util';
import { useMonitor, UNLOAD_KEY } from '../hooks/useMonitor';
import { Modal, useUI } from '../components/ui';
import type { AnswerKeyItem, MonitorEventType, Session, SubmissionReason } from '../types';

export default function ExamPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const resumed = useRef(false);

  useEffect(() => {
    let on = true;
    (async () => {
      const s = await db.sessions.get(id!);
      if (!on) return;
      if (!s) return setSession(null);
      if (s.status === 'submitted') return nav(`/results/${s.id}`, { replace: true });
      if (s.status === 'running') {
        if (s.deadline && Date.now() >= s.deadline) { // deadline passed while away: submit on resume
          await finalizeSession(s, 'TIMEOUT');
          return nav(`/results/${s.id}`, { replace: true });
        }
        resumed.current = true;
      }
      setSession(s);
    })().catch(() => on && setSession(null));
    return () => { on = false; };
  }, [id, nav]);

  if (session === undefined) return <div className="instr muted">Loading examination…</div>;
  if (session === null) return <div className="instr"><h1>Examination not found</h1><p className="mt-s"><Link to="/">Back to dashboard</Link></p></div>;
  if (session.status === 'pending') {
    return <Instructions session={session} onStart={async () => {
      const now = Date.now();
      const first = session.questions[0];
      const next: Session = {
        ...session, status: 'running', startedAt: now, deadline: now + session.durationSec * 1000,
        responses: { ...session.responses, [first.id]: { ...session.responses[first.id], visited: true } },
      };
      await db.sessions.put(next);
      setSession(next);
    }} />;
  }
  return <Runner initial={session} resumed={resumed.current} />;
}

/* ---------------------------------------------------------------- instructions */
function Instructions({ session: s, onStart }: { session: Session; onStart: () => Promise<void> }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const marks = s.questions.reduce((a, q) => a + q.marks, 0);
  const negs = [...new Set(s.questions.map((q) => q.negativeMarks))];
  const start = () => {
    setBusy(true);
    // Fullscreen must be requested synchronously inside the click handler.
    if (s.monitoring && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => undefined);
    onStart();
  };
  return (
    <div className="instr">
      <div className="brand" style={{ padding: 0, marginBottom: 24 }}>EXAM LAB</div>
      <h1>{s.title}</h1>
      <p className="muted mt-s">Please read the instructions carefully before you begin.</p>
      <div className="grid-stats mt">
        <div className="kv"><span>Subject</span><b>{s.subject}</b></div>
        <div className="kv"><span>Questions</span><b>{s.questions.length}</b></div>
        <div className="kv"><span>Duration</span><b>{Math.round(s.durationSec / 60)} min</b></div>
        <div className="kv"><span>Total marks</span><b>{marks}</b></div>
        <div className="kv"><span>Negative marking</span><b>{negs.every((n) => n === 0) ? 'None' : negs.map((n) => `−${n}`).join(' / ') + ' per wrong answer'}</b></div>
        <div className="kv"><span>Mode</span><b>{MODE_LABEL[s.mode]} · {KIND_LABEL[s.kind]}</b></div>
        <div className="kv wide"><span>Sections</span><b>{s.sections.map((x) => `${x} (${s.questions.filter((q) => q.section === x).length})`).join(' · ')}</b></div>
      </div>
      <div className="card mt">
        <h3>Examination rules</h3>
        <ul className="muted">
          <li>The timer starts when you press Start Examination and runs to a fixed deadline. Refreshing or reopening the page does not reset it.</li>
          <li>Select an answer to save it instantly. Use Mark for Review to flag a question; Clear Response removes your answer.</li>
          <li>Use the question palette to jump to any question. Unanswered questions score zero.</li>
          {s.mode === 'practice' && <li>Practice mode: you will see immediate feedback after answering. Monitoring is off.</li>}
          {s.monitoring && <>
            <li>The examination runs in fullscreen. Leaving the window, switching tabs or exiting fullscreen is recorded as a violation.</li>
            <li>{s.autoSubmit ? `Strict mode: after ${s.threshold} warnings, the next violation submits your examination automatically.` : 'Standard mode: violations are recorded and warned about, but never submit the examination automatically.'}</li>
            <li>Monitoring is browser-based and stays on this device. It records when you leave the examination window, not what you opened.</li>
          </>}
          <li>When time ends, the examination is submitted automatically.</li>
        </ul>
      </div>
      <label className="check mt"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I have read and understood the examination instructions.</label>
      <div className="row gap mt">
        <button className="btn btn-primary" disabled={!ok || busy} onClick={start}><Maximize size={15} /> Start Examination</button>
        <Link className="btn" to="/configure">Back</Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- runner */
type CellState = 'notvisited' | 'unanswered' | 'answered' | 'marked' | 'answeredmarked';

function warningText(n: number, threshold: number, auto: boolean): string {
  if (auto && n >= threshold) return 'Final Warning: Another violation will automatically submit your examination.';
  if (n === 1) return 'Warning 1: You left the examination window. Please remain on the examination screen.';
  if (n === 2) return 'Warning 2: Leaving the examination window is not permitted.';
  return `Warning ${n}: Leaving the examination window is not permitted. This violation has been recorded.`;
}

function Runner({ initial, resumed }: { initial: Session; resumed: boolean }) {
  const nav = useNavigate();
  const ui = useUI();
  const [s, setS] = useState(initial);
  const sRef = useRef(initial);
  const [now, setNow] = useState(Date.now());
  const [warning, setWarning] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isFs, setIsFs] = useState(!!document.fullscreenElement);
  const [fsDenied, setFsDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keys, setKeys] = useState<Record<string, AnswerKeyItem>>({});
  const submittingRef = useRef(false);
  const blockNav = useRef(initial.monitoring);
  const recovered = useRef(false);
  const fsSupported = typeof document.documentElement.requestFullscreen === 'function';

  const update = useCallback((fn: (c: Session) => Session) => {
    const next = fn(sRef.current);
    sRef.current = next;
    setS(next);
    db.sessions.put(next).catch(() => ui.toast('Could not save progress to local storage.', 'error'));
  }, [ui]);

  const submit = useCallback(async (reason: SubmissionReason) => {
    if (submittingRef.current) return;
    submittingRef.current = true; blockNav.current = false; setSubmitting(true); setShowSubmit(false);
    try { await finalizeSession(sRef.current, reason); }
    catch (e) { submittingRef.current = false; blockNav.current = sRef.current.monitoring; setSubmitting(false); ui.toast(`Submission failed: ${(e as Error).message}`, 'error'); return; }
    try { localStorage.removeItem(UNLOAD_KEY(sRef.current.id)); } catch { /* ignore */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    nav(`/results/${sRef.current.id}`, { replace: true });
  }, [nav, ui]);

  const addEvent = useCallback((type: MonitorEventType, confirmed: boolean, counted: boolean, note?: string) => {
    if (submittingRef.current) return;
    const cur = sRef.current;
    const ev = { type, at: Date.now(), examId: cur.id, count: cur.events.filter((e) => e.type === type).length + 1, confirmed, counted, note };
    const violations = cur.violations + (counted ? 1 : 0);
    update((c) => ({ ...c, events: [...c.events, ev], violations }));
    if (!counted) return;
    if (cur.autoSubmit && violations > cur.threshold) { setWarning('Violation limit exceeded. Your examination is being submitted.'); submit('VIOLATION_LIMIT'); }
    else setWarning(warningText(violations, cur.threshold, cur.autoSubmit));
  }, [update, submit]);

  const monitor = useMonitor({ active: s.monitoring && !submitting, examId: s.id, countFocusLoss: s.countFocusLoss,
    onEvent: (e) => addEvent(e.type, e.confirmed, e.counted, e.note) });

  // recovery after refresh / reopen
  useEffect(() => {
    monitor.suppress(2500);
    if (resumed && !recovered.current) {
      recovered.current = true;
      let marker = false;
      try { marker = !!localStorage.getItem(UNLOAD_KEY(initial.id)); localStorage.removeItem(UNLOAD_KEY(initial.id)); } catch { /* ignore */ }
      if (initial.monitoring) addEvent('PAGE_RELOAD_OR_RECOVERY', false, false, marker ? 'Page was reloaded or reopened; session restored' : 'Session restored after an interruption (closed tab, crash or sleep)');
    }
    if (initial.mode === 'practice') db.keys.get(initial.id).then((k) => k && setKeys(Object.fromEntries(k.items.map((i) => [i.id, i]))));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // deadline-based timer
  useEffect(() => {
    const tick = () => { const t = Date.now(); setNow(t); if (t >= sRef.current.deadline!) submit('TIMEOUT'); };
    const iv = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); };
  }, [submit]);

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const blocker = useBlocker(() => blockNav.current);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      addEvent('NAVIGATION_ATTEMPT', false, false, 'In-app navigation away from the examination was blocked');
      ui.toast('Navigation is disabled during the examination.', 'info');
      blocker.reset();
    }
  }, [blocker.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const enterFs = async () => {
    monitor.suppress(2500);
    try { await document.documentElement.requestFullscreen(); }
    catch { setFsDenied(true); ui.toast('The browser did not allow fullscreen. You can continue, but this is noted.', 'error'); }
  };

  const needFs = s.monitoring && fsSupported && !isFs && !fsDenied;
  const gate = warning !== null || needFs;
  const dismissGate = async () => { setWarning(null); if (s.monitoring && fsSupported && !document.fullscreenElement && !fsDenied) await enterFs(); };

  // ---- question state
  const q = s.questions[s.currentIndex];
  const r = s.responses[q.id];
  const cellState = (qid: string): CellState => {
    const x = s.responses[qid];
    if (x.selected && x.marked) return 'answeredmarked';
    if (x.marked) return 'marked';
    if (x.selected) return 'answered';
    return x.visited ? 'unanswered' : 'notvisited';
  };
  const setResp = (qid: string, patch: Partial<typeof r>) => update((c) => ({ ...c, responses: { ...c.responses, [qid]: { ...c.responses[qid], ...patch } } }));
  const go = (i: number) => update((c) => {
    const idx = Math.max(0, Math.min(c.questions.length - 1, i));
    const qid = c.questions[idx].id;
    return { ...c, currentIndex: idx, responses: { ...c.responses, [qid]: { ...c.responses[qid], visited: true } } };
  });

  const total = s.questions.length;
  const answered = s.questions.filter((x) => s.responses[x.id].selected).length;
  const marked = s.questions.filter((x) => s.responses[x.id].marked).length;
  const remaining = Math.max(0, s.deadline! - now);
  const key = keys[q.id];
  const practice = s.mode === 'practice';

  return (
    <div className="exam">
      <header className="exam-header">
        <div className="exam-title"><span className="brand" style={{ padding: 0, fontSize: '0.8rem' }}>EXAM LAB</span><b>{s.title}</b></div>
        <div className="row gap">
          <div className={`timer${remaining < 300000 ? ' low' : ''}`} aria-label="Remaining time" role="timer">{fmtClock(remaining)}</div>
          <button className="btn palette-toggle" onClick={() => setPaletteOpen((o) => !o)}><ListChecks size={16} /></button>
          <button className="btn btn-primary" onClick={() => setShowSubmit(true)}>Submit</button>
        </div>
      </header>

      <div className="sectionbar">
        {s.sections.map((sec) => (
          <button key={sec} className={q.section === sec ? 'on' : ''} onClick={() => go(s.questions.findIndex((x) => x.section === sec))}>{sec}</button>
        ))}
        {s.monitoring && !fsSupported && <span className="caption" style={{ alignSelf: 'center', marginLeft: 8 }}>Fullscreen is not supported in this browser.</span>}
        {s.monitoring && fsDenied && <span className="caption" style={{ alignSelf: 'center', marginLeft: 8 }}>Fullscreen unavailable.</span>}
      </div>

      <div className="exam-body">
        <section className="qpanel">
          <div className="qhead"><b>Question {s.currentIndex + 1} of {total}</b><span className="muted">{q.section} · +{q.marks}{q.negativeMarks ? ` / −${q.negativeMarks}` : ''}</span></div>
          <div className="qbody">
            <div className="qtext-main">{q.question}</div>
            {q.options.map((o, i) => {
              const sel = r.selected === o.id;
              let fb = '';
              if (practice && key && r.selected) fb = o.id === key.correctAnswer ? ' fb-correct' : sel ? ' fb-wrong' : '';
              return (
                <button key={o.id} className={`opt${sel ? ' selected' : ''}${fb}`} aria-pressed={sel} onClick={() => setResp(q.id, { selected: o.id })}>
                  <span className="ol">{letter(i)}</span><span style={{ whiteSpace: 'pre-wrap' }}>{o.text}</span>
                </button>
              );
            })}
            {practice && key && r.selected && (
              <div className={`banner ${r.selected === key.correctAnswer ? 'ok' : 'error'}`}>
                <b>{r.selected === key.correctAnswer ? 'Correct.' : `Incorrect. Correct answer: ${letter(q.options.findIndex((o) => o.id === key.correctAnswer))}.`}</b>
                {key.explanation && <div style={{ marginTop: 4 }}>{key.explanation}</div>}
              </div>
            )}
          </div>
          <div className="qnav">
            <button className="btn" disabled={s.currentIndex === 0} onClick={() => go(s.currentIndex - 1)}><ChevronLeft size={15} /> Previous</button>
            <button className="btn" onClick={() => setResp(q.id, { selected: null })} disabled={!r.selected}><Eraser size={15} /> Clear Response</button>
            <button className="btn" onClick={() => setResp(q.id, { marked: !r.marked })}><Bookmark size={15} /> {r.marked ? 'Unmark Review' : 'Mark for Review'}</button>
            <span className="spacer" />
            <button className="btn btn-primary" onClick={() => { if (s.currentIndex < total - 1) go(s.currentIndex + 1); else ui.toast('Answer saved. This is the last question.', 'success'); }}><Save size={15} /> Save &amp; Next</button>
            <button className="btn" disabled={s.currentIndex === total - 1} onClick={() => go(s.currentIndex + 1)}>Next <ChevronRight size={15} /></button>
          </div>
        </section>

        <aside className={`side${paletteOpen ? ' open' : ''}`}>
          <div className="card" style={{ padding: 16 }}>
            <h3>Question palette</h3>
            <div className="palette-grid">
              {s.questions.map((x, i) => (
                <button key={x.id} className={`pcell ${cellState(x.id)}${i === s.currentIndex ? ' cur' : ''}`} aria-label={`Question ${i + 1}: ${cellState(x.id)}`}
                  onClick={() => { go(i); setPaletteOpen(false); }}>{i + 1}</button>
              ))}
            </div>
            <div className="legend mt-s">
              <span><i />Not visited</span><span><i className="l-un" />Unanswered</span>
              <span><i className="l-an" />Answered</span><span><i className="l-mk" />Marked</span>
              <span style={{ gridColumn: '1 / -1' }}><i className="l-am" />Answered &amp; marked</span>
            </div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <h3>Summary</h3>
            <div className="summary-list">
              <span>Total questions</span><b>{total}</b><span>Answered</span><b>{answered}</b>
              <span>Unanswered</span><b>{total - answered}</b><span>Marked for review</span><b>{marked}</b>
              <span>Remaining time</span><b>{fmtClock(remaining)}</b>
            </div>
          </div>
        </aside>
      </div>

      {showSubmit && (
        <Modal title="Submit examination?" onClose={() => setShowSubmit(false)}
          footer={<><button className="btn" onClick={() => setShowSubmit(false)}>Go Back</button><button className="btn btn-primary" onClick={() => submit('MANUAL')}>Submit Examination</button></>}>
          <div className="summary-list">
            <span>Answered</span><b>{answered}</b><span>Unanswered</span><b>{total - answered}</b>
            <span>Marked for review</span><b>{marked}</b><span>Time remaining</span><b>{fmtClock(remaining)}</b>
          </div>
          <p className="caption mt-s">You cannot change your answers after submitting.</p>
        </Modal>
      )}

      {gate && !submitting && (
        <div className="gate" role="alertdialog" aria-modal="true">
          <div className="modal">
            <h2 className="modal-title">{warning ? 'Examination warning' : 'Fullscreen required'}</h2>
            {warning && <p className="warn-text">{warning}</p>}
            {needFs && <p className="muted">{warning ? 'Return to fullscreen to continue.' : 'This examination must run in fullscreen. Click below to continue; your timer is still running.'}</p>}
            <div className="modal-footer"><button className="btn btn-primary" onClick={dismissGate}><Maximize size={15} /> Return to Examination</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
