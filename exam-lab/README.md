# EXAM LAB

Offline-first examination simulator. React + Vite + TypeScript, IndexedDB (Dexie), React Router, Recharts, PWA.
No backend, no accounts, no network calls, no AI.

## Run
```
npm install
npm run dev        # development
npm run build      # type-check + production build (also generates the offline cache list)
npm run preview    # serve the production build (offline/PWA works here, not in dev)
```

## Question banks
Import JSON on **Import Questions**. Start from `question-banks/blank-template.json` or `question-banks/sample-aptitude-set-01.json`
(both also downloadable inside the app). Format: `schemaVersion "1.0"`, `setId`, `title`, `subject`, `durationMinutes`, `negativeMarking`,
`sections[]`, `questions[]` (`id`, `section`, `type: "single_choice"`, `question`, `options[{id,text}]`, `correctAnswer`, optional
`marks`, `negativeMarks`, `difficulty`, `explanation`, `tags`). `negativeMarking` is marks deducted per wrong answer.

**Replace Active Question Bank** archives the current bank and activates the new one in a single transaction. Banks are never merged,
history keeps its own snapshots, and in-progress tests are never altered.

## Design tokens
All colours live in `src/styles/tokens.css`. The values are PROVISIONAL neutral placeholders: the reference site's CSS could not be
read. Replace the variables there with the reference palette; no component hardcodes colours.

## Monitoring notes
Browser events only (visibilitychange, blur/focus, fullscreenchange, beforeunload, pagehide/pageshow). One away-incident counts once even if
several events fire. Strict mode auto-submits when violations exceed the configured warning count (default 3, so the 4th violation submits).
It cannot detect which app or site was opened, and it is not a lockdown.

## Structure
`src/lib/exam.ts` presentation service (strips answers) · `src/lib/scoring.ts` scoring service · `src/lib/submit.ts` atomic submission ·
`src/hooks/useMonitor.ts` monitoring · `src/lib/db.ts` IndexedDB stores: banks, sessions, keys, results, settings.
