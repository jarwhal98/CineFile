# CineFile

A local-first app to track movies you've watched against various "best of" lists. Built with React, Vite, TypeScript, and IndexedDB (Dexie).

## Features
- Import lists (CSV) and merge views across lists
- Show movie posters and details via TMDB
- Track what you've seen, with 0–10 ratings (0.5 steps) and watch dates
- PWA ready (install on mobile/desktop); service worker enabled in production builds
- Backup & Restore: export/import your local data as JSON
- Optional multi-device sync via Supabase (email link login)
- View stats and progress across lists

## Dev
- Vite + React + TS
- Material UI
- Dexie (IndexedDB)
- Vitest

## Quick start
1. Install dependencies
2. Run the dev server
3. Open http://localhost:5174

## TMDB
Add your TMDB API key in Settings. Data is stored locally in your browser.

## Optional: Family passcode gate
Set an env var VITE_FAMILY_CODE to require a passcode before accessing the app. The code is checked on the client and stored in session only.

Env example:

```
VITE_TMDB_API_KEY=your_tmdb_key
VITE_FAMILY_CODE=some-shared-secret
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Optional: Multi-device sync
Provide Supabase env vars above, then in Settings send yourself a sign-in link and click "Sync now" to push/pull.

License: MIT
