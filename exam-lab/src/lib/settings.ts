import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultDurationMinutes: null,
  shuffleQuestions: true,
  shuffleOptions: true,
  defaultMode: 'strict',
  monitoringEnabled: true,
  threshold: 3,
  countFocusLoss: true,
};

export function useSettings(): Settings {
  const row = useLiveQuery(() => db.settings.get('app'), []);
  return { ...DEFAULT_SETTINGS, ...(row ?? {}) };
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await db.settings.get('app')) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>) {
  const next = { ...(await getSettings()), ...patch };
  await db.settings.put({ ...next, id: 'app' });
  try { localStorage.setItem('examlab-theme', next.theme); } catch { /* ignore */ }
}
