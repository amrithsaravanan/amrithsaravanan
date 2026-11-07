import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, GitCompare, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import { Empty, Modal, PageHeader, useUI } from '../components/ui';
import { downloadJSON, fmtDate, fmtDuration, slug } from '../lib/util';
import type { ResultRecord } from '../types';

export default function HistoryPage() {
  const results = useLiveQuery(() => db.results.orderBy('submittedAt').reverse().toArray(), []);
  const open = useLiveQuery(() => db.sessions.where('status').anyOf('pending', 'running').toArray(), []);
  const ui = useUI();
  const [sel, setSel] = useState<string[]>([]);
  const [cmp, setCmp] = useState(false);
  if (!results || !open) return null;

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));
  const del = async (r: ResultRecord) => {
    if (await ui.confirm({ title: 'Delete this record?', danger: true, confirmLabel: 'Delete', body: <p>“{r.title}” and its stored snapshots will be permanently deleted.</p> })) {
      await db.results.delete(r.id); await db.sessions.delete(r.id); setSel((s) => s.filter((x) => x !== r.id)); ui.toast('Record deleted', 'success');
    }
  };
  const discard = async (id: string) => {
    if (await ui.confirm({ title: 'Discard unfinished test?', danger: true, confirmLabel: 'Discard', body: <p>This in-progress test will be deleted without a result.</p> })) {
      await db.transaction('rw', db.sessions, db.keys, async () => { await db.sessions.delete(id); await db.keys.delete(id); });
    }
  };
  const pair = sel.map((id) => results.find((r) => r.id === id)).filter(Boolean) as ResultRecord[];

  return (
    <>
      <PageHeader title="Test History" sub="Every completed examination, stored on this device."
        actions={<>
          <button className="btn" disabled={pair.length !== 2} onClick={() => setCmp(true)}><GitCompare size={15} /> Compare selected</button>
          <button className="btn" disabled={!results.length} onClick={() => downloadJSON('exam-lab-results.json', results)}><Download size={15} /> Export all</button>
        </>} />
      {open.length > 0 && (
        <div className="stack" style={{ marginBottom: 20, gap: 8 }}>
          {open.map((o) => (
            <div className="bank" key={o.id}><div><b>{o.title}</b> <span className="chip chip-archived">{o.status === 'pending' ? 'not started' : 'in progress'}</span></div>
              <div className="bank-actions"><Link className="btn btn-sm btn-primary" to={`/exam/${o.id}`}>Continue</Link><button className="btn btn-sm btn-danger" onClick={() => discard(o.id)}>Discard</button></div></div>))}
        </div>
      )}
      {results.length === 0 ? <Empty title="No history yet" text="Completed tests appear here." action={<Link className="btn btn-primary" to="/configure">Start a test</Link>} /> : (
        <div className="table-wrap"><table>
          <thead><tr><th /><th>Test</th><th>Subject</th><th>Date</th><th className="num">Score</th><th className="num">Accuracy</th><th className="num">Duration</th><th>Submitted</th><th /></tr></thead>
          <tbody>{results.map((r) => (
            <tr key={r.id}>
              <td><input type="checkbox" aria-label="Select for comparison" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} /></td>
              <td>{r.title}</td><td>{r.subject}</td><td>{fmtDate(r.submittedAt)}</td>
              <td className="num">{r.score} / {r.maxScore}</td><td className="num">{r.accuracy}%</td><td className="num">{fmtDuration(r.timeTakenSec)}</td>
              <td>{r.submissionReason === 'MANUAL' ? 'Manual' : r.submissionReason === 'TIMEOUT' ? 'Time up' : 'Violations'}</td>
              <td><div className="bank-actions" style={{ flexWrap: 'nowrap' }}>
                <Link className="btn btn-sm" to={`/results/${r.id}`}>View</Link>
                <button className="btn btn-sm" aria-label="Export" onClick={() => downloadJSON(`result-${slug(r.title)}.json`, r)}><Download size={13} /></button>
                <button className="btn btn-sm btn-danger" aria-label="Delete" onClick={() => del(r)}><Trash2 size={13} /></button></div></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {cmp && pair.length === 2 && (
        <Modal title="Compare tests" wide onClose={() => setCmp(false)} footer={<button className="btn" onClick={() => setCmp(false)}>Close</button>}>
          <div className="table-wrap"><table>
            <thead><tr><th>Metric</th><th>{pair[0].title}</th><th>{pair[1].title}</th></tr></thead>
            <tbody>{([
              ['Date', (r: ResultRecord) => fmtDate(r.submittedAt)], ['Score', (r) => `${r.score} / ${r.maxScore}`], ['Percentage', (r) => `${r.percentage}%`],
              ['Accuracy', (r) => `${r.accuracy}%`], ['Correct', (r) => r.correct], ['Incorrect', (r) => r.incorrect], ['Unanswered', (r) => r.unanswered],
              ['Time taken', (r) => fmtDuration(r.timeTakenSec)], ['Avg / question', (r) => fmtDuration(r.avgTimePerQuestionSec)], ['Violations', (r) => r.monitoring ? r.violations : 'n/a'],
            ] as [string, (r: ResultRecord) => string | number][]).map(([k, f]) => <tr key={k}><td>{k}</td><td>{f(pair[0])}</td><td>{f(pair[1])}</td></tr>)}</tbody>
          </table></div>
        </Modal>
      )}
    </>
  );
}
