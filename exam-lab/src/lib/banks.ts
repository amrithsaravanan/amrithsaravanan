import { db } from './db';
import { uid } from './util';
import type { Bank, BankFile, BankStatus } from '../types';

export const toBank = (f: BankFile, status: BankStatus): Bank => ({ ...f, id: uid(), status, importedAt: Date.now() });
export const toBankFile = (b: Bank): BankFile => {
  const { schemaVersion, setId, title, subject, description, durationMinutes, totalMarks, negativeMarking, sections, questions } = b;
  return { schemaVersion, setId, title, subject, description, durationMinutes, totalMarks, negativeMarking, sections, questions };
};

export const addBank = (f: BankFile) => db.banks.add(toBank(f, 'available'));

export const addAndActivate = (f: BankFile) =>
  db.transaction('rw', db.banks, async () => {
    await db.banks.where('status').equals('active').modify({ status: 'available' });
    await db.banks.add(toBank(f, 'active'));
  });

/** Atomic: archive the current active bank and activate the new one. On failure nothing changes. */
export const replaceActive = (f: BankFile) =>
  db.transaction('rw', db.banks, async () => {
    await db.banks.where('status').equals('active').modify({ status: 'archived', archivedAt: Date.now() });
    await db.banks.add(toBank(f, 'active'));
  });

export const activateBank = (id: string) =>
  db.transaction('rw', db.banks, async () => {
    await db.banks.where('status').equals('active').modify({ status: 'available' });
    await db.banks.update(id, { status: 'active', archivedAt: undefined });
  });

export const archiveBank = (id: string) => db.banks.update(id, { status: 'archived', archivedAt: Date.now() });
export const restoreBank = (id: string) => db.banks.update(id, { status: 'available', archivedAt: undefined });
export const deleteBank = (id: string) => db.banks.delete(id); // results keep their own snapshots
