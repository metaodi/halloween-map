# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server, http://localhost:5173
npm run typecheck    # tsc --noEmit (also run as part of `npm run build`)
npm test             # vitest run (all tests)
npx vitest run src/lib/token.test.ts   # single test file
npx vitest run -t "name"               # single test by name
npm run build        # typecheck + production build into dist/
```

There is no linter configured. Local setup: `cp .env.example .env` (see README for variables). Without `VITE_SUPABASE_*`, the map shows demo entries (`src/lib/demoData.ts`); creating entries and admin do not work.

## Architecture

Static frontend (Vite + TypeScript, no UI framework, Leaflet/OpenStreetMap) backed directly by Supabase; there is no custom server. UI text and the README are in German (Swiss).

- **Routing** is query-string based in `src/main.ts` (GitHub Pages has no rewrites): `?admin` → `AdminPage`, `?ort=<slug>` → `MapPage`, `?gemeinden` forces `VillageSelectPage`, `?loeschen=<token>` is the personal delete link. `VITE_DEFAULT_VILLAGE` is used when `?ort` is absent.
- **Villages** are defined only in `src/config/villages.ts` (slug, center, bbox, ...). Adding a village needs no other code change; the DB only validates the slug format. `bbox` bounds address search and rejects results outside it.
- **Geocoding** (`src/lib/geocoding/`): `GeocoderProvider` interface with `swisstopo` (default) and `photon` implementations, chosen via `VITE_GEOCODER`.
- **Supabase** (`src/lib/supabase/`, schema in `supabase/migrations/`): security is enforced by RLS and RPCs in the DB, not the client.
  - `anon` cannot touch `entries` directly; reads go through the view `public_entries` (no `delete_token_hash`).
  - Writes/deletes go through RPCs `create_entry`, `get_entry_by_token`, `delete_entry`. The client generates the delete token with `crypto.randomUUID()` (`src/lib/token.ts`); only its SHA-256 hash is stored.
  - Admins (`auth.uid()` in `public.admins`) get full access by policy.
  - Messages (per village board, `src/components/messagesDialog.ts`): read via view `public_messages`, write via RPC `create_message`, which sanitizes with `sanitize_plain_text` (mirrored client-side in `src/lib/sanitize.ts`) and sets `is_admin` only for real admins. Sticky/delete are admin-only direct table updates. Toggle globally in `src/config/features.ts`, per village via `Village.messages`.
  - `create_entry` validates lengths, Swiss coordinate range, slug format, and rate-limits 5 entries/min/village. Changing validation (e.g. non-Swiss villages) means a new migration.
- **Components** (`src/components/`) are plain DOM-building functions using helpers in `src/lib/dom.ts`; pages in `src/pages/` compose them.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml` → GitHub Pages at `halloweenkarte.ch` (`public/CNAME`, `VITE_BASE: /`). Env vars come from GitHub Actions *Variables*. Entries are intentionally kept until revoked; do not add automatic cleanup.
