export interface Option { id: string; text: string }

export interface Question {
  id: string;
  section: string;
  type: 'single_choice';
  difficulty?: string;
  question: string;
  options: Option[];
  correctAnswer: string;
  marks: number;
  negativeMarks: number;
  explanation?: string;
  tags?: string[];
}

/** Shape of the JSON file a user imports/exports. */
export interface BankFile {
  schemaVersion: string;
  setId: string;
  title: string;
  subject: string;
  description?: string;
  durationMinutes: number;
  totalMarks: number;
  negativeMarking: number;
  sections: string[];
  questions: Question[];
}

export type BankStatus = 'active' | 'available' | 'archived';
export interface Bank extends BankFile { id: string; status: BankStatus; importedAt: number; archivedAt?: number }

export type ExamMode = 'practice' | 'standard' | 'strict';
export type TestKind = 'full' | 'section' | 'custom';
export type SubmissionReason = 'MANUAL' | 'TIMEOUT' | 'VIOLATION_LIMIT';

/** What the examination UI may see. NEVER contains answers or explanations. */
export interface PresentedQuestion {
  id: string;
  section: string;
  difficulty?: string;
  question: string;
  options: Option[];
  marks: number;
  negativeMarks: number;
}
export interface AnswerKeyItem { id: string; correctAnswer: string; explanation?: string }
export interface AnswerKeyRecord { sessionId: string; items: AnswerKeyItem[] }

export interface QResponse { selected: string | null; visited: boolean; marked: boolean }

export type MonitorEventType =
  | 'TAB_HIDDEN' | 'WINDOW_FOCUS_LOST' | 'FULLSCREEN_EXIT' | 'PAGE_RELOAD_OR_RECOVERY' | 'NAVIGATION_ATTEMPT';
export interface MonitorEvent {
  type: MonitorEventType;
  at: number;
  examId: string;
  /** running count of events of this type */
  count: number;
  /** true only when the browser itself reported the page as hidden / fullscreen exited */
  confirmed: boolean;
  /** whether this event counted towards the violation total */
  counted: boolean;
  note?: string;
}

export interface Session {
  id: string;
  title: string;
  bankId: string;
  bankTitle: string;
  subject: string;
  kind: TestKind;
  mode: ExamMode;
  section?: string;
  sections: string[];
  questions: PresentedQuestion[];
  durationSec: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  // monitoring policy, frozen at creation
  monitoring: boolean;
  autoSubmit: boolean;
  threshold: number;
  countFocusLoss: boolean;
  // lifecycle
  status: 'pending' | 'running' | 'submitted';
  createdAt: number;
  startedAt?: number;
  deadline?: number;
  submittedAt?: number;
  submissionReason?: SubmissionReason;
  currentIndex: number;
  responses: Record<string, QResponse>;
  events: MonitorEvent[];
  violations: number;
}

export interface ReviewItem {
  id: string;
  section: string;
  question: string;
  options: Option[];
  selected: string | null;
  correctAnswer: string;
  explanation?: string;
  marks: number;
  negativeMarks: number;
  awarded: number;
  status: 'correct' | 'incorrect' | 'unanswered';
}
export interface SectionStat {
  section: string; total: number; correct: number; incorrect: number; unanswered: number;
  score: number; maxScore: number; accuracy: number;
}
export interface ResultRecord {
  id: string;
  title: string;
  bankId: string;
  bankTitle: string;
  subject: string;
  kind: TestKind;
  mode: ExamMode;
  createdAt: number;
  startedAt: number;
  submittedAt: number;
  durationSec: number;
  timeTakenSec: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  avgTimePerQuestionSec: number;
  submissionReason: SubmissionReason;
  sectionStats: SectionStat[];
  items: ReviewItem[];
  monitoring: boolean;
  threshold: number;
  events: MonitorEvent[];
  violations: number;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  defaultDurationMinutes: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  defaultMode: ExamMode;
  monitoringEnabled: boolean;
  threshold: number;
  countFocusLoss: boolean;
}
