import { useCallback, useEffect, useRef } from 'react';
import type { MonitorEventType } from '../types';

export interface MonitorEmit { type: MonitorEventType; confirmed: boolean; counted: boolean; note?: string }

export const UNLOAD_KEY = (id: string) => `examlab:unloading:${id}`;

/**
 * Browser-only activity monitor. Uses visibilitychange, blur/focus, fullscreenchange,
 * beforeunload, pagehide and pageshow. It cannot know which app or site was opened.
 *
 * De-duplication: one "away incident" is opened by the first of (tab hidden | focus lost).
 * Further events inside the same incident are logged but NOT counted. The incident closes
 * when the page is visible and focused again (or the user interacts with the page).
 */
export function useMonitor(opts: { active: boolean; examId: string; countFocusLoss: boolean; onEvent: (e: MonitorEmit) => void }) {
  const ref = useRef(opts);
  ref.current = opts;
  const st = useRef({ away: false, graceUntil: 0, blurTimer: 0 as unknown as ReturnType<typeof setTimeout>, fsWasOn: false });

  /** Ignore window events briefly (fullscreen transitions, permission prompts). */
  const suppress = useCallback((ms: number) => { st.current.graceUntil = Date.now() + ms; }, []);

  useEffect(() => {
    if (!opts.active) return;
    const s = st.current;
    s.away = false;
    s.fsWasOn = !!document.fullscreenElement;
    const emit = (type: MonitorEventType, confirmed: boolean, counted: boolean, note?: string) =>
      ref.current.onEvent({ type, confirmed, counted, note });
    const graced = () => Date.now() < s.graceUntil;
    const back = () => { if (!document.hidden && document.hasFocus()) s.away = false; };

    const onVis = () => {
      if (document.hidden) {
        clearTimeout(s.blurTimer);
        if (graced()) return;
        if (!s.away) { s.away = true; emit('TAB_HIDDEN', true, true, 'Page became hidden (tab switch or minimise)'); }
        else emit('TAB_HIDDEN', true, false, 'Part of an already counted incident');
      } else back();
    };
    const onBlur = () => {
      if (graced() || s.away) return;
      clearTimeout(s.blurTimer);
      s.blurTimer = setTimeout(() => {
        if (document.hidden || document.hasFocus() || s.away || graced()) return;
        s.away = true;
        emit('WINDOW_FOCUS_LOST', false, ref.current.countFocusLoss, 'Window lost focus but page stayed visible (unconfirmed)');
      }, 400);
    };
    const onFocus = () => { clearTimeout(s.blurTimer); back(); };
    const onFs = () => {
      if (document.fullscreenElement) { s.fsWasOn = true; return; }
      if (!s.fsWasOn) return;
      s.fsWasOn = false;
      if (graced()) return;
      if (s.away) emit('FULLSCREEN_EXIT', true, false, 'Part of an already counted incident');
      else { emit('FULLSCREEN_EXIT', true, true, 'Fullscreen exited'); s.graceUntil = Date.now() + 1000; }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      try { localStorage.setItem(UNLOAD_KEY(ref.current.examId), String(Date.now())); } catch { /* ignore */ }
      emit('NAVIGATION_ATTEMPT', false, false, 'Reload, close or navigation away from the page was attempted');
      e.preventDefault();
      e.returnValue = '';
    };
    const onPageHide = () => { try { localStorage.setItem(UNLOAD_KEY(ref.current.examId), String(Date.now())); } catch { /* ignore */ } };
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) emit('PAGE_RELOAD_OR_RECOVERY', false, false, 'Page restored from browser cache'); };
    const onInteract = () => { back(); try { localStorage.removeItem(UNLOAD_KEY(ref.current.examId)); } catch { /* ignore */ } };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('pointerdown', onInteract);
    document.addEventListener('keydown', onInteract);
    return () => {
      clearTimeout(s.blurTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('pointerdown', onInteract);
      document.removeEventListener('keydown', onInteract);
    };
  }, [opts.active]); // eslint-disable-line react-hooks/exhaustive-deps

  return { suppress };
}
