# 🎃 HalloweenMap

Trick-or-Treat-Karte für Dörfer und Quartiere: Familien tragen ihre Adresse selbst ein und erscheinen mit einem 🎃-Marker. Gebaut mit Vite, TypeScript (ohne UI-Framework), Leaflet/OpenStreetMap und Supabase. Das Frontend ist rein statisch.

## Voraussetzungen

- Node.js 20 oder neuer
- Ein kostenloses [Supabase](https://supabase.com)-Projekt

## Supabase einrichten

1. **Projekt anlegen** auf supabase.com.
2. **Migration einspielen:** Im Dashboard unter *SQL Editor* den Inhalt von `supabase/migrations/20261024000000_init.sql` ausführen (oder mit der Supabase-CLI `supabase db push`).
3. **Registrierung deaktivieren:** *Authentication → Sign In / Providers → «Allow new users to sign up»* ausschalten.
4. **Admin-User anlegen:** *Authentication → Users → Add user* (E-Mail + Passwort, «Auto Confirm User» aktivieren).
5. **Admin freischalten:** Die User-ID (UUID) des neuen Users kopieren und im SQL Editor ausführen:
   ```sql
   insert into public.admins (user_id) values ('<user-uuid>');
   ```
6. **API-Werte notieren:** *Project Settings → API* → *Project URL* und *anon public key*.

### Sicherheitsmodell

- `anon` hat **keinen** direkten Zugriff auf `entries`. Lesen geht nur über die View `public_entries` (ohne `delete_token_hash`).
- Schreiben und Löschen nur über die RPCs `create_entry`, `get_entry_by_token` und `delete_entry`. Der Löschtoken wird im Browser mit `crypto.randomUUID()` erzeugt, in der DB liegt nur sein SHA-256-Hash.
- `create_entry` prüft Längen, Koordinaten (Plausibilitätsbereich Schweiz inkl. Grenzregion) und das Format des Orts-Slugs und erlaubt max. 5 Einträge pro Minute und Ort.
- Admins (`auth.uid()` steht in `admins`) haben per Policy volle Rechte auf `entries`. Die Prüfung läuft in der Datenbank, nicht im Client.

## Konfiguration

```bash
cp .env.example .env
```

| Variable | Bedeutung |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public key (darf im Frontend stehen, die Daten schützt RLS) |
| `VITE_DEFAULT_VILLAGE` | Slug des Orts ohne `?ort=…`. Leer lassen, um eine Ort-Auswahlseite zu zeigen |
| `VITE_GEOCODER` | `swisstopo` (Default) oder `photon` |

Ohne Supabase-Variablen zeigt die Karte beim lokalen Entwickeln Demo-Einträge; Eintragen und Admin funktionieren dann nicht.

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run build      # Produktions-Build nach dist/
```

- Karte: `http://localhost:5173/?ort=<slug>`
- Admin: `http://localhost:5173/admin`
- Löschlink: `/?ort=<slug>&loeschen=<token>`

## Neuen Ort hinzufügen

Nur in `src/config/villages.ts` einen Eintrag ergänzen, kein weiterer Code-Change:

```ts
{
  slug: 'meinedorf',                 // a-z, 0-9, Bindestrich; kommt in die URL und in die DB
  name: 'Meindorf',
  center: [47.30, 8.62],             // [lat, lng]
  zoom: 14,
  bbox: [8.55, 47.25, 8.72, 47.35],  // [minLng, minLat, maxLng, maxLat]
  eventDate: '2026-10-31',           // optional
  welcomeText: 'Willkommen!',        // optional
}
```

Die `bbox` begrenzt die Adresssuche und lehnt Treffer ausserhalb ab. Der erste Eintrag (`pfnuselkueste`) ist ein Platzhalter mit geschätzten Werten.

> Die Datenbank kennt die Orte nicht, sie prüft nur das Slug-Format. Orte ausserhalb der Schweiz erfordern eine Anpassung der Koordinaten-Plausibilität in `create_entry`.

## Deployment (Cloudflare Pages)

1. Repository in Cloudflare Pages verbinden (*Workers & Pages → Create → Pages → Connect to Git*).
2. Build command: `npm run build`, Output directory: `dist`.
3. Unter *Settings → Environment variables* die vier `VITE_…`-Variablen setzen.
4. `/admin` ist eine Client-Route: Cloudflare Pages liefert dafür `index.html` automatisch, `public/_redirects` deckt Netlify ab. Bei GitHub Pages `dist/index.html` zusätzlich als `404.html` kopieren.

## Automatisches Löschen nach Halloween

Die Oberfläche verspricht, dass Einträge nach Halloween gelöscht werden. Das erledigt ein Cron-Job in Supabase (*Database → Extensions → pg_cron* aktivieren), z. B. am 5. November um 03:00 Uhr:

```sql
select cron.schedule(
  'halloween-cleanup',
  '0 3 5 11 *',
  $$ delete from public.entries $$
);
```

Wer Orte mit unterschiedlichen Daten betreibt, löscht gezielt: `delete from public.entries where village_slug = 'meinedorf'`.

## Projektstruktur

```
src/
  config/villages.ts      Orte
  lib/supabase/           Client, Einträge (öffentlich), Admin
  lib/geocoding/          GeocoderProvider, swisstopo, Photon
  lib/token.ts            Token-Erzeugung, Hash, localStorage
  components/             Karte, Dialog, Autocomplete, Formular, …
  pages/                  Karte, Ort-Auswahl, Admin
supabase/migrations/      SQL
```

## Hinweise

- Karten-Kacheln stammen vom öffentlichen OpenStreetMap-Server (Nutzungsrichtlinien beachten; bei viel Verkehr einen Kachel-Anbieter verwenden).
- Photon (`photon.komoot.io`) ist ein öffentlicher Dienst ohne Garantie.
