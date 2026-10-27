/**
 * Holt für alle Orte aus src/config/villages.ts die Bounding-Box bei swisstopo
 * (SearchServer: Gemeinden "gg25" und Postleitzahl-Gebiete "zipcode") und vergleicht sie mit der
 * konfigurierten bbox. Ändert nichts, gibt nur einen Bericht aus.
 *
 * Aufruf (Node 22): node --experimental-strip-types scripts/fetch-bboxes.ts
 * In GitHub Actions wird der Bericht zusätzlich in die Job-Zusammenfassung geschrieben.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { villages, type Village } from '../src/config/villages.ts';

type BBox = Village['bbox'];
type Origin = 'gg25' | 'zipcode';

interface Query {
  origin: Origin;
  text: string;
}

interface Match {
  slug: string;
  origin: Origin;
  label: string;
  bbox: BBox;
}

const SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

/** Orte, die keine Gemeinde sind oder deren Name nicht eindeutig ist: Suche über PLZ */
const overrides: Record<string, Query[]> = {
  au: [{ origin: 'zipcode', text: '8804' }],
  wollishofen: [{ origin: 'zipcode', text: '8038' }],
};

function queriesFor(v: Village): Query[] {
  const name = v.name.replace(/\s*\(.*\)$/, '');
  return overrides[v.slug] ?? [
    { origin: 'gg25', text: name },
    { origin: 'zipcode', text: name },
  ];
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();
const normalize = (s: string) => s.toLocaleLowerCase('de-CH');

/** Gemeinde: "Horgen (ZH)" o. ä.; PLZ: "8810 - Horgen" bzw. "8804 - Au ZH" */
function labelMatches(origin: Origin, label: string, text: string): boolean {
  const l = normalize(label);
  const t = normalize(text);
  if (origin === 'gg25') return l === t || l.startsWith(`${t} (`);
  if (/^\d{4}$/.test(text)) return l.startsWith(`${t} `);
  const place = l.replace(/^\d{4}\s*-\s*/, '');
  return place === t || place.startsWith(`${t} `);
}

/** Näherungsformel von swisstopo, LV95 bzw. LV03 → WGS84, Genauigkeit ~1 m */
function toWgs84(e: number, n: number): [number, number] {
  const y = (e > 2_000_000 ? e - 2_600_000 : e - 600_000) / 1e6;
  const x = (n > 1_000_000 ? n - 1_200_000 : n - 200_000) / 1e6;
  const lng = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y ** 3;
  const lat =
    16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x ** 3;
  return [(lng * 100) / 36, (lat * 100) / 36];
}

/** "BOX(minX minY,maxX maxY)" in WGS84, LV95 oder LV03 */
function parseBox(box: string): BBox | undefined {
  const m = box.match(/BOX\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
  if (!m) return undefined;
  const [minX, minY, maxX, maxY] = m.slice(1).map(Number);
  if (minX < 1000) return [minX, minY, maxX, maxY];
  // Projizierte Koordinaten: alle Ecken umrechnen, da das Gitter gegenüber WGS84 leicht gedreht ist
  const corners = [toWgs84(minX, minY), toWgs84(minX, maxY), toWgs84(maxX, minY), toWgs84(maxX, maxY)];
  const lngs = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/** Auf 3 Nachkommastellen (~100 m) nach aussen runden */
function roundOut([minLng, minLat, maxLng, maxLat]: BBox): BBox {
  const down = (n: number) => Math.floor(n * 1000) / 1000;
  const up = (n: number) => Math.ceil(n * 1000) / 1000;
  return [down(minLng), down(minLat), up(maxLng), up(maxLat)];
}

async function search(q: Query): Promise<{ label: string; bbox: BBox }[]> {
  const url = new URL(SEARCH_URL);
  url.search = new URLSearchParams({
    type: 'locations',
    origins: q.origin,
    searchText: q.text,
    sr: '4326',
    limit: '20',
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${q.origin} "${q.text}": HTTP ${res.status}`);
  const data = (await res.json()) as { results?: { attrs?: { label?: string; geom_st_box2d?: string } }[] };
  const out: { label: string; bbox: BBox }[] = [];
  for (const r of data.results ?? []) {
    const label = stripTags(r.attrs?.label ?? '');
    const bbox = r.attrs?.geom_st_box2d ? parseBox(r.attrs.geom_st_box2d) : undefined;
    if (bbox && labelMatches(q.origin, label, q.text)) out.push({ label, bbox: roundOut(bbox) });
  }
  return out;
}

const fmt = (b: BBox) => `[${b.join(', ')}]`;

function contains([minLng, minLat, maxLng, maxLat]: BBox, [lat, lng]: [number, number]): boolean {
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

async function main() {
  const matches: Match[] = [];
  const lines: string[] = [
    '| Ort | Quelle | Treffer | bbox swisstopo | bbox aktuell | Zentrum drin? |',
    '|---|---|---|---|---|---|',
  ];
  for (const v of villages) {
    for (const q of queriesFor(v)) {
      let found: { label: string; bbox: BBox }[];
      try {
        found = await search(q);
      } catch (e) {
        lines.push(`| ${v.slug} | ${q.origin} "${q.text}" | Fehler: ${(e as Error).message} | | ${fmt(v.bbox)} | |`);
        continue;
      }
      if (found.length === 0) lines.push(`| ${v.slug} | ${q.origin} "${q.text}" | kein Treffer | | ${fmt(v.bbox)} | |`);
      for (const f of found) {
        matches.push({ slug: v.slug, origin: q.origin, ...f });
        const centerInside = contains(f.bbox, v.center) ? 'ja' : '**nein**';
        lines.push(`| ${v.slug} | ${q.origin} | ${f.label} | ${fmt(f.bbox)} | ${fmt(v.bbox)} | ${centerInside} |`);
      }
    }
  }

  const report = `## Bounding-Boxen von swisstopo\n\nFormat: [minLng, minLat, maxLng, maxLat]\n\n${lines.join('\n')}\n`;
  console.log(report);
  console.log('JSON:');
  console.log(JSON.stringify(matches, null, 2));
  writeFileSync('bboxes.json', `${JSON.stringify(matches, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
}

await main();
