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

export class SwisstopoGeocoder implements GeocoderProvider {
  async search(query: string, bbox: BBox, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({
      searchText: query,
      type: 'locations',
      origins: 'address',
      sr: '4326',
      limit: '5',
      bbox: bbox.join(','),
    });
    const res = await fetch(`${ENDPOINT}?${params}`, { signal });
    if (!res.ok) throw new Error(`swisstopo: HTTP ${res.status}`);
    return parseSwisstopo((await res.json()) as SwisstopoResponse, bbox);
  }
}
