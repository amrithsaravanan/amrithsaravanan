import type { BankFile } from '../types';
import { letter } from '../lib/util';

export function BankSummary({ bank }: { bank: BankFile }) {
  return (
    <div className="grid-stats">
      <div className="kv"><span>Title</span><b>{bank.title}</b></div>
      <div className="kv"><span>Subject</span><b>{bank.subject}</b></div>
      <div className="kv"><span>Questions</span><b>{bank.questions.length}</b></div>
      <div className="kv"><span>Duration</span><b>{bank.durationMinutes} min</b></div>
      <div className="kv"><span>Total marks</span><b>{bank.totalMarks}</b></div>
      <div className="kv"><span>Negative marking</span><b>{bank.negativeMarking}</b></div>
      <div className="kv wide"><span>Sections</span><b>{bank.sections.map((s) => `${s} (${bank.questions.filter((q) => q.section === s).length})`).join(' · ')}</b></div>
    </div>
  );
}

export function QuestionList({ bank, limit }: { bank: BankFile; limit?: number }) {
  const qs = limit ? bank.questions.slice(0, limit) : bank.questions;
  return (
    <div className="qlist">
      {qs.map((q, i) => (
        <div key={q.id} className="qprev">
          <div className="caption">{i + 1}. {q.id} · {q.section} · {q.difficulty ?? '—'} · {q.marks} mark(s)</div>
          <div className="qtext">{q.question}</div>
          <ul>
            {q.options.map((o, k) => (
              <li key={o.id} className={o.id === q.correctAnswer ? 'is-correct' : ''}>{letter(k)}. {o.text}{o.id === q.correctAnswer ? '  ✓' : ''}</li>
            ))}
          </ul>
          {q.explanation && <div className="caption">Explanation: {q.explanation}</div>}
        </div>
      ))}
    </div>
  );
}
