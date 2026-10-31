# 🎃 HalloweenKarte

Trick-or-Treat-Karte für Dörfer und Quartiere: Familien tragen ihre Adresse selbst ein und erscheinen mit einem 🎃-Marker. Gebaut mit Vite, TypeScript (ohne UI-Framework), Leaflet/OpenStreetMap und Supabase. Das Frontend ist rein statisch und wird über GitHub Pages ausgeliefert.

## Voraussetzungen

- Node.js 20 oder neuer
- Ein kostenloses [Supabase](https://supabase.com)-Projekt

## Supabase einrichten

1. **Projekt anlegen** auf supabase.com.
2. **Migration einspielen:** Im Dashboard unter *SQL Editor* den Inhalt aller Dateien in `supabase/migrations/` der Reihe nach ausführen (`20261024000000_init.sql`, dann `20261031000000_messages.sql`) (oder mit der Supabase-CLI `supabase db push`).
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
- **Nachrichten:** Lesen über die View `public_messages`, Schreiben nur über die RPC `create_message`. Sie bereinigt Name und Text mit `sanitize_plain_text` (entfernt HTML-Tags, BBCode, Steuer- und unsichtbare Zeichen; Markdown wird nicht interpretiert), prüft Längen (Name ≤ 30, Text ≤ 500 Zeichen) und erlaubt max. 10 Nachrichten pro Minute und Ort. Das Admin-Flag setzt nur die DB, wenn der angemeldete User in `admins` steht. Anheften (sticky) und Löschen dürfen per Policy nur Admins. Angezeigt wird ausschliesslich als Text (kein `innerHTML`).

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

Nachrichten pro Ort (Button «Nachrichten» auf der Karte) werden in `src/config/features.ts` global ein- oder ausgeschaltet (`messages: true/false`) und lassen sich pro Ort in `src/config/villages.ts` mit `messages: false` bzw. `true` überschreiben. Ist man im selben Browser unter `?admin` als Admin angemeldet, kann man im Nachrichten-Dialog Admin-Nachrichten (blau markiert) senden sowie Nachrichten anheften und löschen.

Ohne Supabase-Variablen zeigt die Karte beim lokalen Entwickeln Demo-Einträge; Eintragen und Admin funktionieren dann nicht.

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run build      # Produktions-Build nach dist/ (VITE_BASE für Unterpfad, z. B. /halloween-map/)
```

- Karte: `http://localhost:5173/?ort=<slug>`
- Admin: `http://localhost:5173/?admin`
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

## Deployment (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut bei jedem Push auf `main` (und manuell über *Actions → Run workflow*) und veröffentlicht `dist/` auf GitHub Pages.

1. **Pages aktivieren:** *Settings → Pages → Build and deployment → Source: «GitHub Actions»*.
2. **Variablen setzen:** *Settings → Secrets and variables → Actions → Variables* (Reiter *Variables*, nicht *Secrets*; der anon key ist ohnehin öffentlich):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEFAULT_VILLAGE`, `VITE_GEOCODER`.
3. **Deployen:** Auf `main` pushen bzw. mergen. Die Seite erscheint unter `https://halloweenkarte.ch/`.

Hinweise:

- Eigene Domain: `public/CNAME` enthält `halloweenkarte.ch`, der Workflow baut mit `VITE_BASE: /`. Bei Betrieb unter `https://<user>.github.io/<repo>/` müsste `VITE_BASE: /<repo>/` gesetzt und `public/CNAME` entfernt werden.
- DNS: Beim Registrar `A`-Records für `halloweenkarte.ch` auf `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (optional `AAAA`: `2606:50c0:8000::153` bis `2606:50c0:8003::153`) und `CNAME www` auf `<user>.github.io`. Danach in *Settings → Pages → Custom domain* die Domain eintragen und *Enforce HTTPS* aktivieren.- GitHub Pages kennt keine Rewrites. Deshalb ist der Admin-Bereich über `?admin` erreichbar (`https://halloweenkarte.ch/?admin`) statt über einen Pfad.
- Supabase: Unter *Authentication → URL Configuration* `https://halloweenkarte.ch` als *Site URL* eintragen (und unter *Redirect URLs* ergänzen).

## Als App installieren (PWA)

Die Seite ist eine Progressive Web App (`public/manifest.webmanifest`, Icons `public/icon*.png` und `public/icon.svg`, 🎃-Kürbis). Es braucht keinen App-Store:

- **iPhone (Safari):** Teilen-Symbol → *Zum Home-Bildschirm*.
- **Android (Chrome):** Menü ⋮ → *App installieren* bzw. *Zum Startbildschirm hinzufügen*.

Die App startet dann ohne Browserleiste. Einen Service Worker gibt es bewusst nicht, die Karte braucht ohnehin Internet.

## Aufbewahrung der Daten

Einträge bleiben bis zum Widerruf gespeichert, z. B. für das nächste Halloween. Die Oberfläche sagt das auch so. Es gibt kein automatisches Löschen; wer widerrufen will, nutzt den persönlichen Löschlink (oder meldet sich beim Betreiber, der über die Admin-Seite löscht).

Falls ein früher eingerichteter `pg_cron`-Job `halloween-cleanup` existiert, muss er entfernt werden, sonst löscht er die Einträge trotzdem: `select cron.unschedule('halloween-cleanup');`

## Projektstruktur

```
src/
  config/villages.ts      Orte
  config/features.ts      Funktionen ein/aus (z. B. Nachrichten)
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
