import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, RotateCcw, Library, History as HistoryIcon } from 'lucide-react';
import { db } from '../lib/db';
import { Empty, PageHeader, Stat } from '../components/ui';
import { fmtDate, fmtDuration } from '../lib/util';

export default function Dashboard() {
  const results = useLiveQuery(() => db.results.orderBy('submittedAt').reverse().toArray(), []);
  const banks = useLiveQuery(() => db.banks.toArray(), []);
  const open = useLiveQuery(() => db.sessions.where('status').anyOf('pending', 'running').toArray(), []);
  if (!results || !banks || !open) return null;

  const avail = banks.filter((b) => b.status !== 'archived');
  const totalQ = avail.reduce((a, b) => a + b.questions.length, 0);
  const avgAcc = results.length ? results.reduce((a, r) => a + r.accuracy, 0) / results.length : null;
  const best = results.length ? results.reduce((b, r) => (r.percentage > b.percentage ? r : b)) : null;
  const cont = open.sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <>
      <div className="hero">
        <h1>Your next assessment starts here.</h1>
        <p className="muted">Practice consistently. Evaluate accurately. Improve continuously.</p>
      </div>

      <div className="grid-stats">
        <Stat label="Tests completed" value={results.length} />
        <Stat label="Average accuracy" value={avgAcc === null ? '—' : `${avgAcc.toFixed(1)}%`} />
        <Stat label="Best score" value={best ? `${best.score} / ${best.maxScore}` : '—'} hint={best ? `${best.percentage}%` : undefined} />
        <Stat label="Available questions" value={totalQ} />
        <Stat label="Question banks" value={avail.length} />
      </div>

      <div className="actions-grid">
        <Link to="/configure" className="action primary"><b><Play size={16} /> Start New Test</b><span className="caption">Configure and begin an examination</span></Link>
        <Link to={cont ? `/exam/${cont.id}` : '#'} className="action" aria-disabled={!cont}>
          <b><RotateCcw size={16} /> Continue Previous Test</b>
          <span className="caption">{cont ? cont.title : 'No test in progress'}</span>
        </Link>
        <Link to="/banks" className="action"><b><Library size={16} /> Manage Question Banks</b><span className="caption">Import, replace, archive</span></Link>
        <Link to="/history" className="action"><b><HistoryIcon size={16} /> View Test History</b><span className="caption">Results and review</span></Link>
      </div>

      <h2 style={{ marginBottom: 12 }}>Recent examination activity</h2>
      {results.length === 0 ? (
        <Empty title="No examinations yet" text="Completed tests will appear here with their score and accuracy."
          action={<Link className="btn btn-primary" to={banks.length ? '/configure' : '/import'}>{banks.length ? 'Start your first test' : 'Import a question bank'}</Link>} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Test</th><th>Subject</th><th>Date</th><th className="num">Score</th><th className="num">Accuracy</th><th className="num">Duration</th><th /></tr></thead>
            <tbody>
              {results.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td><td>{r.subject}</td><td>{fmtDate(r.submittedAt)}</td>
                  <td className="num">{r.score} / {r.maxScore}</td><td className="num">{r.accuracy}%</td>
                  <td className="num">{fmtDuration(r.timeTakenSec)}</td>
                  <td><Link to={`/results/${r.id}`}>View Result</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
