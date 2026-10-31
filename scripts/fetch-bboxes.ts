/**
 * Berechnet für alle Orte aus src/config/villages.ts eine bbox aus den PLZ-Gebieten von swisstopo
 * (amtliches Ortschaftenverzeichnis, SearchServer "zipcode"), mit etwas Puffer, und vergleicht sie
 * mit der konfigurierten bbox. Ändert nichts, gibt nur einen Bericht aus.
 *
 * Aufruf (Node 22): node --experimental-strip-types scripts/fetch-bboxes.ts
 * In GitHub Actions wird der Bericht zusätzlich in die Job-Zusammenfassung geschrieben.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { villages, type Village } from '../src/config/villages.ts';

type BBox = Village['bbox'];

interface Area {
  plz: string;
  /** Nur nötig, wenn mehrere Ortschaften dieselbe PLZ haben */
  place?: string;
}

interface Match {
  label: string;
  bbox: BBox;
}

const SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

/** Puffer in Grad rund um die PLZ-Gebiete (~150 m in Länge, ~220 m in Breite) */
const BUFFER = 0.002;

/** PLZ-Gebiete pro Ort; ein neuer Ort braucht hier einen Eintrag */
const areas: Record<string, Area[]> = {
  adliswil: [{ plz: '8134' }],
  au: [{ plz: '8804' }],
  baech: [{ plz: '8806' }],
  freienbach: [{ plz: '8807' }],
  hurden: [{ plz: '8640', place: 'Hurden' }],
  pfaeffikon: [{ plz: '8808', place: 'Pfäffikon' }],
  hirzel: [{ plz: '8816' }],
  horgen: [{ plz: '8810' }],
  huenenberg: [{ plz: '6331' }, { plz: '6333' }],
  kilchberg: [{ plz: '8802' }],
  'langnau-am-albis': [{ plz: '8135' }],
  oberrieden: [{ plz: '8942' }],
  richterswil: [{ plz: '8805' }],
  rueschlikon: [{ plz: '8803' }],
  thalwil: [{ plz: '8800' }],
  waedenswil: [{ plz: '8820' }],
  wollerau: [{ plz: '8832', place: 'Wollerau' }],
  wollishofen: [{ plz: '8038' }],
};

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();
const normalize = (s: string) => s.toLocaleLowerCase('de-CH');

/** Label z. B. "8810 - Horgen" bzw. "8804 - Au ZH" */
function labelMatches(label: string, area: Area): boolean {
  const l = normalize(label);
  if (!l.startsWith(`${area.plz} `)) return false;
  if (!area.place) return true;
  const place = l.replace(/^\d{4}\s*-?\s*/, '');
  const p = normalize(area.place);
  return place === p || place.startsWith(`${p} `);
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

function union(boxes: BBox[]): BBox {
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
}

/** Puffer anlegen und auf 3 Nachkommastellen (~100 m) nach aussen runden */
function bufferAndRound([minLng, minLat, maxLng, maxLat]: BBox): BBox {
  const down = (n: number) => Math.floor((n - BUFFER) * 1000) / 1000;
  const up = (n: number) => Math.ceil((n + BUFFER) * 1000) / 1000;
  return [down(minLng), down(minLat), up(maxLng), up(maxLat)];
}

async function search(area: Area): Promise<{ found: Match[]; others: string[] }> {
  const url = new URL(SEARCH_URL);
  url.search = new URLSearchParams({
    type: 'locations',
    origins: 'zipcode',
    searchText: area.plz,
    sr: '4326',
    limit: '20',
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PLZ ${area.plz}: HTTP ${res.status}`);
  const data = (await res.json()) as { results?: { attrs?: { label?: string; geom_st_box2d?: string } }[] };
  const found: Match[] = [];
  const others: string[] = [];
  for (const r of data.results ?? []) {
    const label = stripTags(r.attrs?.label ?? '');
    const bbox = r.attrs?.geom_st_box2d ? parseBox(r.attrs.geom_st_box2d) : undefined;
    if (bbox && labelMatches(label, area)) found.push({ label, bbox });
    else others.push(label);
  }
  return { found, others };
}

const fmt = (b: BBox) => `[${b.join(', ')}]`;
const round = (b: BBox) => b.map((n) => Math.round(n * 1e4) / 1e4) as BBox;

function contains([minLng, minLat, maxLng, maxLat]: BBox, [lat, lng]: [number, number]): boolean {
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

async function main() {
  const proposals: Record<string, BBox> = {};
  const lines: string[] = [
    '| Ort | PLZ-Gebiete (exakt) | bbox vorgeschlagen | bbox aktuell | Zentrum drin? |',
    '|---|---|---|---|---|',
  ];
  for (const v of villages) {
    const wanted = areas[v.slug];
    if (!wanted) {
      lines.push(`| ${v.slug} | keine PLZ in scripts/fetch-bboxes.ts | | ${fmt(v.bbox)} | |`);
      continue;
    }
    const matches: Match[] = [];
    const problems: string[] = [];
    for (const area of wanted) {
      try {
        const { found, others } = await search(area);
        if (found.length === 0) problems.push(`${area.plz}: kein Treffer (${others.slice(0, 5).join('; ') || '–'})`);
        matches.push(...found);
      } catch (e) {
        problems.push((e as Error).message);
      }
    }
    const exact = matches.map((m) => `${m.label} ${fmt(round(m.bbox))}`);
    const cells = [...exact, ...problems.map((p) => `**${p}**`)].join('<br>');
    if (matches.length === 0) {
      lines.push(`| ${v.slug} | ${cells} | | ${fmt(v.bbox)} | |`);
      continue;
    }
    const proposed = bufferAndRound(union(matches.map((m) => m.bbox)));
    proposals[v.slug] = proposed;
    const centerInside = contains(proposed, v.center) ? 'ja' : '**nein**';
    lines.push(`| ${v.slug} | ${cells} | ${fmt(proposed)} | ${fmt(v.bbox)} | ${centerInside} |`);
  }

  const report =
    `## Bounding-Boxen aus PLZ-Gebieten (swisstopo)\n\n` +
    `Format: [minLng, minLat, maxLng, maxLat], Puffer ${BUFFER}°\n\n${lines.join('\n')}\n`;
  console.log(report);
  console.log('JSON:');
  console.log(JSON.stringify(proposals, null, 2));
  writeFileSync('bboxes.json', `${JSON.stringify(proposals, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
}

await main();
