import { db } from './db';
import { scoreSession } from './scoring';
import type { Session, SubmissionReason } from '../types';

/** Idempotent: submitting twice never creates two results. Single atomic transaction. */
export async function finalizeSession(s: Session, reason: SubmissionReason): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.sessions, db.keys, db.results, async () => {
    if (await db.results.get(s.id)) return;
    const key = await db.keys.get(s.id);
    if (!key) throw new Error('Answer key for this session is missing.');
    await db.results.put(scoreSession(s, key.items, reason, now));
    await db.sessions.put({ ...s, status: 'submitted', submittedAt: now, submissionReason: reason });
    await db.keys.delete(s.id);
  });
}
