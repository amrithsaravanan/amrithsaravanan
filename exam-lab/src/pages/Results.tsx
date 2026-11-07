import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { db } from '../lib/db';
import { Empty, PageHeader, Stat } from '../components/ui';
import { downloadJSON, fmtDateTime, fmtDuration, letter, slug } from '../lib/util';
import { MODE_LABEL } from '../lib/exam';
import type { MonitorEventType, ResultRecord } from '../types';

const REASON: Record<string, string> = {
  MANUAL: 'Submitted manually', TIMEOUT: 'Automatically submitted: time expired', VIOLATION_LIMIT: 'Automatically submitted: violation limit exceeded',
};
const EVT: Record<MonitorEventType, string> = {
  TAB_HIDDEN: 'Tab hidden (confirmed)', WINDOW_FOCUS_LOST: 'Window focus lost (unconfirmed)', FULLSCREEN_EXIT: 'Fullscreen exit',
  PAGE_RELOAD_OR_RECOVERY: 'Page reload / session recovery', NAVIGATION_ATTEMPT: 'Navigation attempt',
};
const tip = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text)' };

export default function Results() {
  const { id } = useParams();
  const r = useLiveQuery(() => db.results.get(id!), [id]);
  const [tab, setTab] = useState<'overview' | 'review' | 'monitoring'>('overview');
  if (r === undefined) return null;
  if (!r) return <Empty title="Result not found" text="This result may have been deleted." action={<Link className="btn" to="/history">Test history</Link>} />;

  return (
    <>
      <PageHeader title={r.title} sub={`${r.subject} · ${MODE_LABEL[r.mode]} · ${fmtDateTime(r.submittedAt)}`}
        actions={<>
          <button className="btn" onClick={() => downloadJSON(`result-${slug(r.title)}.json`, r)}><Download size={15} /> Export</button>
          <Link className="btn btn-primary" to="/configure">New test</Link>
        </>} />
      <div className="tabs">
        {(['overview', 'review', 'monitoring'] as const).map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t === 'overview' ? 'Overview' : t === 'review' ? 'Answer review' : 'Monitoring report'}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview r={r} />}
      {tab === 'review' && <Review r={r} />}
      {tab === 'monitoring' && <Monitoring r={r} />}
    </>
  );
}

function Overview({ r }: { r: ResultRecord }) {
  const pie = [
    { name: 'Correct', value: r.correct, c: 'var(--success)' }, { name: 'Incorrect', value: r.incorrect, c: 'var(--error)' }, { name: 'Unanswered', value: r.unanswered, c: 'var(--border)' },
  ].filter((d) => d.value > 0);
  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat label="Final score" value={`${r.score} / ${r.maxScore}`} hint={`${r.percentage}%`} />
        <Stat label="Accuracy" value={`${r.accuracy}%`} hint="correct of attempted" />
        <Stat label="Correct" value={r.correct} /><Stat label="Incorrect" value={r.incorrect} /><Stat label="Unanswered" value={r.unanswered} />
        <Stat label="Time taken" value={fmtDuration(r.timeTakenSec)} hint={`of ${fmtDuration(r.durationSec)}`} />
        <Stat label="Avg per question" value={fmtDuration(r.avgTimePerQuestionSec)} />
      </div>
      <div className="two-col">
        <div className="card"><h3>Section accuracy</h3>
          <div className="chart-box"><ResponsiveContainer>
            <BarChart data={r.sectionStats.map((x) => ({ name: x.section, Accuracy: x.accuracy }))}>
              <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-2)' }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
              <Tooltip contentStyle={tip} cursor={{ fill: 'var(--hover)' }} /><Bar dataKey="Accuracy" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart></ResponsiveContainer></div></div>
        <div className="card"><h3>Answer breakdown</h3>
          <div className="chart-box"><ResponsiveContainer>
            <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} stroke="var(--surface)">{pie.map((d) => <Cell key={d.name} fill={d.c} />)}</Pie>
              <Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer></div></div>
      </div>
      <h3>Section-wise results</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Section</th><th className="num">Total</th><th className="num">Correct</th><th className="num">Incorrect</th><th className="num">Unanswered</th><th className="num">Score</th><th className="num">Accuracy</th></tr></thead>
        <tbody>{r.sectionStats.map((x) => (
          <tr key={x.section}><td>{x.section}</td><td className="num">{x.total}</td><td className="num">{x.correct}</td><td className="num">{x.incorrect}</td><td className="num">{x.unanswered}</td><td className="num">{x.score} / {x.maxScore}</td><td className="num">{x.accuracy}%</td></tr>))}</tbody>
      </table></div>
    </div>
  );
}

function Review({ r }: { r: ResultRecord }) {
  const [f, setF] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  const items = r.items.filter((i) => f === 'all' || i.status === f);
  return (
    <>
      <div className="seg" style={{ maxWidth: 460, marginBottom: 16 }}>
        {(['all', 'correct', 'incorrect', 'unanswered'] as const).map((k) => (
          <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k[0].toUpperCase() + k.slice(1)}{k === 'all' ? ` (${r.items.length})` : ` (${r.items.filter((i) => i.status === k).length})`}</button>))}
      </div>
      <div className="review">
        {items.length === 0 && <Empty title="Nothing to show" text="No questions match this filter." />}
        {items.map((i) => {
          const n = r.items.indexOf(i) + 1;
          return (
            <div className="rv" key={i.id}>
              <div className="row between wrap">
                <span className="caption">Question {n} · {i.section}</span>
                <span className="row gap" style={{ gap: 8 }}>
                  <span className={`chip ${i.status === 'correct' ? 'chip-success' : i.status === 'incorrect' ? 'chip-error' : ''}`}>{i.status}</span>
                  <b>{i.awarded > 0 ? '+' : ''}{i.awarded}</b>
                </span>
              </div>
              <div className="qtext" style={{ margin: '8px 0' }}>{i.question}</div>
              {i.options.map((o, k) => (
                <div key={o.id} className={`rv-opt${o.id === i.correctAnswer ? ' correct' : o.id === i.selected ? ' wrong' : ''}`}>
                  <b>{letter(k)}</b><span>{o.text}{o.id === i.selected ? '  (your answer)' : ''}{o.id === i.correctAnswer ? '  (correct)' : ''}</span>
                </div>))}
              <div className="rv-note">
                <div><b>Your answer:</b> {i.selected ? letter(i.options.findIndex((o) => o.id === i.selected)) : 'Not answered'} · <b>Correct answer:</b> {letter(i.options.findIndex((o) => o.id === i.correctAnswer))} · <b>Marks:</b> {i.awarded}</div>
                {i.explanation && <div style={{ marginTop: 6 }}><b>Explanation:</b> {i.explanation}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Monitoring({ r }: { r: ResultRecord }) {
  if (!r.monitoring) return <Empty title="Monitoring was not active" text="This examination ran without activity monitoring (practice mode or monitoring disabled in Settings)." />;
  const n = (t: MonitorEventType) => r.events.filter((e) => e.type === t).length;
  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat label="Confirmed tab-hidden violations" value={r.events.filter((e) => e.type === 'TAB_HIDDEN' && e.counted).length} />
        <Stat label="Focus-loss events" value={n('WINDOW_FOCUS_LOST')} hint="unconfirmed" />
        <Stat label="Fullscreen exits" value={n('FULLSCREEN_EXIT')} />
        <Stat label="Navigation attempts" value={n('NAVIGATION_ATTEMPT')} />
        <Stat label="Counted violations" value={r.violations} hint={`warnings allowed: ${r.threshold}`} />
      </div>
      <div className="banner">
        <b>Submission:</b> {REASON[r.submissionReason]} · <b>Auto-submitted by violations:</b> {r.submissionReason === 'VIOLATION_LIMIT' ? 'Yes' : 'No'}
      </div>
      <div className="banner">Monitoring is browser-based. Focus-loss events are not confirmed tab switches, and the report cannot show which website or application was opened.</div>
      {r.events.length === 0 ? <Empty title="No events recorded" text="The examination window was not left." /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Time</th><th>Event</th><th>Confirmed</th><th>Counted</th><th>Note</th></tr></thead>
          <tbody>{r.events.map((e, i) => (
            <tr key={i}><td>{i + 1}</td><td>{fmtDateTime(e.at)}</td><td>{EVT[e.type]} #{e.count}</td><td>{e.confirmed ? 'Yes' : 'No'}</td><td>{e.counted ? 'Yes' : 'No'}</td><td style={{ whiteSpace: 'normal' }}>{e.note ?? ''}</td></tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}
