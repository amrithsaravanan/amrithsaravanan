import { db } from './db';
import { downloadJSON } from './util';
import { toBankFile } from './banks';

const APP = 'EXAM LAB';
const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportAll() {
  const [banks, sessions, keys, results, settings] = await Promise.all([
    db.banks.toArray(), db.sessions.toArray(), db.keys.toArray(), db.results.toArray(), db.settings.toArray(),
  ]);
  downloadJSON(`exam-lab-backup-${stamp()}.json`,
    { app: APP, kind: 'backup', version: 1, exportedAt: new Date().toISOString(), banks, sessions, keys, results, settings });
}

export async function exportBanks() {
  const banks = await db.banks.toArray();
  downloadJSON(`exam-lab-question-banks-${stamp()}.json`,
    { app: APP, kind: 'question-banks', banks: banks.map((b) => ({ status: b.status, ...toBankFile(b) })) });
}

export async function restoreBackup(raw: unknown): Promise<{ banks: number; results: number }> {
  const d = raw as Record<string, unknown>;
  if (!d || d.app !== APP || d.kind !== 'backup') throw new Error('This is not an EXAM LAB backup file.');
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as never[]) : []);
  await db.transaction('rw', [db.banks, db.sessions, db.keys, db.results, db.settings], async () => {
    await db.banks.bulkPut(arr('banks'));
    await db.sessions.bulkPut(arr('sessions'));
    await db.keys.bulkPut(arr('keys'));
    await db.results.bulkPut(arr('results'));
    await db.settings.bulkPut(arr('settings'));
  });
  return { banks: arr('banks').length, results: arr('results').length };
}

export async function clearAll() {
  await db.transaction('rw', [db.banks, db.sessions, db.keys, db.results, db.settings], async () => {
    await Promise.all([db.banks.clear(), db.sessions.clear(), db.keys.clear(), db.results.clear(), db.settings.clear()]);
  });
}
