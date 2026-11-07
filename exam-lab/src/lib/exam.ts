import type { AnswerKeyItem, Bank, ExamMode, PresentedQuestion, Question, Session, Settings, TestKind } from '../types';
import { shuffle, uid } from './util';

export interface TestConfig {
  bank: Bank;
  kind: TestKind;
  section?: string;
  count: number;
  durationMin: number;
  marksOverride: number | null;
  negativeOverride: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  mode: ExamMode;
}

export const KIND_LABEL: Record<TestKind, string> = { full: 'Full-length', section: 'Section-wise', custom: 'Custom' };
export const MODE_LABEL: Record<ExamMode, string> = { practice: 'Practice', standard: 'Standard exam', strict: 'Strict exam' };

export function poolFor(bank: Bank, kind: TestKind, section?: string): Question[] {
  if (kind === 'full') return bank.questions;
  if (section) return bank.questions.filter((q) => q.section === section);
  return bank.questions;
}

/**
 * Presentation service: builds an exam session. Questions given to the UI have no
 * answers or explanations; those go to a separate answer-key record that is only
 * read at submission (or in practice mode for instant feedback).
 */
export function buildSession(cfg: TestConfig, settings: Settings): { session: Session; keys: AnswerKeyItem[] } {
  const { bank } = cfg;
  const pool = poolFor(bank, cfg.kind, cfg.section);
  const index = new Map(bank.questions.map((q, i) => [q.id, i]));

  let chosen = pool;
  if (cfg.kind !== 'full' && cfg.count < pool.length) chosen = shuffle(pool).slice(0, cfg.count); // unique, no repeats

  const grouped = bank.sections.flatMap((sec) => {
    const qs = chosen.filter((q) => q.section === sec).sort((a, b) => index.get(a.id)! - index.get(b.id)!);
    return cfg.shuffleQuestions ? shuffle(qs) : qs;
  });

  const presented: PresentedQuestion[] = grouped.map((q) => ({
    id: q.id, section: q.section, difficulty: q.difficulty, question: q.question,
    options: cfg.shuffleOptions ? shuffle(q.options) : q.options.map((o) => ({ ...o })),
    marks: cfg.marksOverride ?? q.marks,
    negativeMarks: cfg.negativeOverride ?? q.negativeMarks,
  }));
  const keys: AnswerKeyItem[] = grouped.map((q) => ({ id: q.id, correctAnswer: q.correctAnswer, explanation: q.explanation }));

  const sections = bank.sections.filter((s) => presented.some((p) => p.section === s));
  const responses = Object.fromEntries(presented.map((p) => [p.id, { selected: null, visited: false, marked: false }]));
  const session: Session = {
    id: uid(),
    title: `${bank.title} — ${KIND_LABEL[cfg.kind]}${cfg.kind === 'section' && cfg.section ? ` (${cfg.section})` : ''}`,
    bankId: bank.id, bankTitle: bank.title, subject: bank.subject,
    kind: cfg.kind, mode: cfg.mode, section: cfg.section, sections,
    questions: presented,
    durationSec: Math.round(cfg.durationMin * 60),
    shuffleQuestions: cfg.shuffleQuestions, shuffleOptions: cfg.shuffleOptions,
    monitoring: cfg.mode !== 'practice' && settings.monitoringEnabled,
    autoSubmit: cfg.mode === 'strict',
    threshold: settings.threshold,
    countFocusLoss: settings.countFocusLoss,
    status: 'pending', createdAt: Date.now(),
    currentIndex: 0, responses, events: [], violations: 0,
  };
  return { session, keys };
}
