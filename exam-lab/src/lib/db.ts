import Dexie, { type Table } from 'dexie';
import type { AnswerKeyRecord, Bank, ResultRecord, Session, Settings } from '../types';

export type SettingsRow = Settings & { id: string };

class ExamLabDB extends Dexie {
  banks!: Table<Bank, string>;
  sessions!: Table<Session, string>;
  keys!: Table<AnswerKeyRecord, string>;
  results!: Table<ResultRecord, string>;
  settings!: Table<SettingsRow, string>;
  constructor() {
    super('examlab');
    this.version(1).stores({
      banks: 'id, setId, status, importedAt',  // question banks (active / available / archived)
      sessions: 'id, status, createdAt',       // exam sessions: question snapshot, answers, monitoring events
      keys: 'sessionId',                       // answer keys, kept apart from the exam UI until submission
      results: 'id, bankId, submittedAt',      // final results incl. full question + response snapshots
      settings: 'id',
    });
  }
}
export const db = new ExamLabDB();
