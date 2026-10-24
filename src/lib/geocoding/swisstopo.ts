import { filterByBBox } from './bbox';
import type { BBox, GeocodeResult, GeocoderProvider } from './types';

const ENDPOINT = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

interface SwisstopoResponse {
  results?: Array<{ attrs?: { label?: string; lat?: number; lon?: number } }>;
}

/** «Seestrasse 12 <b>8700 Küsnacht</b>» → «Seestrasse 12, 8700 Küsnacht» */
export function cleanSwisstopoLabel(raw: string): string {
  const text = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return text.replace(/^(.*)\s(\d{4}\s\D.*)$/, '$1, $2');
}

export function parseSwisstopo(json: SwisstopoResponse, bbox: BBox): GeocodeResult[] {
  const results: GeocodeResult[] = [];
  for (const item of json.results ?? []) {
    const a = item.attrs;
    if (!a || typeof a.lat !== 'number' || typeof a.lon !== 'number' || !a.label) continue;
    results.push({ label: cleanSwisstopoLabel(a.label), lat: a.lat, lng: a.lon });
  }
  return filterByBBox(results, bbox);
}

/**
 * WGS84 → LV95 (E, N) nach der Näherungsformel von swisstopo (Genauigkeit ~1 m).
 * Die SearchServer-API interpretiert `bbox` nur in LV95/LV03, nicht in WGS84.
 */
export function wgs84ToLv95(lat: number, lng: number): [number, number] {
  const phi = (lat * 3600 - 169028.66) / 10000;
  const lam = (lng * 3600 - 26782.5) / 10000;
  const e =
    2600072.37 + 211455.93 * lam - 10938.51 * lam * phi - 0.36 * lam * phi ** 2 - 44.54 * lam ** 3;
  const n =
    1200147.07 + 308807.95 * phi + 3745.25 * lam ** 2 + 76.63 * phi ** 2 - 194.56 * lam ** 2 * phi + 119.79 * phi ** 3;
  return [e, n];
}

export function bboxToLv95(bbox: BBox): [number, number, number, number] {
  const [minE, minN] = wgs84ToLv95(bbox[1], bbox[0]);
  const [maxE, maxN] = wgs84ToLv95(bbox[3], bbox[2]);
  return [minE, minN, maxE, maxN];
}

export class SwisstopoGeocoder implements GeocoderProvider {
  async search(query: string, bbox: BBox, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({
      searchText: query,
      type: 'locations',
      origins: 'address',
      sr: '2056',
      limit: '20',
      bbox: bboxToLv95(bbox).map((v) => Math.round(v)).join(','),
    });
    const res = await fetch(`${ENDPOINT}?${params}`, { signal });
    if (!res.ok) throw new Error(`swisstopo: HTTP ${res.status}`);
    return parseSwisstopo((await res.json()) as SwisstopoResponse, bbox).slice(0, 8);
  }
}
