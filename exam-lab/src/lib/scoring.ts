import type { AnswerKeyItem, ResultRecord, ReviewItem, SectionStat, Session, SubmissionReason } from '../types';
import { round2 } from './util';

/** Scoring service: deterministic, only used at/after submission. */
export function scoreSession(s: Session, keys: AnswerKeyItem[], reason: SubmissionReason, now: number): ResultRecord {
  const keyMap = new Map(keys.map((k) => [k.id, k]));
  const items: ReviewItem[] = s.questions.map((q) => {
    const k = keyMap.get(q.id);
    const selected = s.responses[q.id]?.selected ?? null;
    const correctAnswer = k?.correctAnswer ?? '';
    let status: ReviewItem['status'] = 'unanswered';
    let awarded = 0;
    if (selected) {
      if (selected === correctAnswer) { status = 'correct'; awarded = q.marks; }
      else { status = 'incorrect'; awarded = -q.negativeMarks; }
    }
    return { id: q.id, section: q.section, question: q.question, options: q.options, selected, correctAnswer,
      explanation: k?.explanation, marks: q.marks, negativeMarks: q.negativeMarks, awarded, status };
  });

  const count = (st: ReviewItem['status']) => items.filter((i) => i.status === st).length;
  const correct = count('correct'), incorrect = count('incorrect'), unanswered = count('unanswered');
  const score = round2(items.reduce((a, i) => a + i.awarded, 0));
  const maxScore = round2(items.reduce((a, i) => a + i.marks, 0));
  const attempted = correct + incorrect;

  const sectionStats: SectionStat[] = s.sections.map((sec) => {
    const its = items.filter((i) => i.section === sec);
    const c = its.filter((i) => i.status === 'correct').length;
    const w = its.filter((i) => i.status === 'incorrect').length;
    return { section: sec, total: its.length, correct: c, incorrect: w, unanswered: its.length - c - w,
      score: round2(its.reduce((a, i) => a + i.awarded, 0)), maxScore: round2(its.reduce((a, i) => a + i.marks, 0)),
      accuracy: c + w ? round2((c / (c + w)) * 100) : 0 };
  });

  const startedAt = s.startedAt ?? s.createdAt;
  const end = Math.min(now, s.deadline ?? now);
  const timeTakenSec = Math.max(0, Math.round((end - startedAt) / 1000));

  return {
    id: s.id, title: s.title, bankId: s.bankId, bankTitle: s.bankTitle, subject: s.subject, kind: s.kind, mode: s.mode,
    createdAt: s.createdAt, startedAt, submittedAt: now, durationSec: s.durationSec, timeTakenSec,
    totalQuestions: items.length, correct, incorrect, unanswered, score, maxScore,
    percentage: maxScore ? round2((score / maxScore) * 100) : 0,
    accuracy: attempted ? round2((correct / attempted) * 100) : 0,
    avgTimePerQuestionSec: items.length ? round2(timeTakenSec / items.length) : 0,
    submissionReason: reason, sectionStats, items,
    monitoring: s.monitoring, threshold: s.threshold, events: s.events, violations: s.violations,
  };
}
