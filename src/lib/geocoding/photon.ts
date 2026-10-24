import { filterByBBox } from './bbox';
import type { BBox, GeocodeResult, GeocoderProvider } from './types';

const ENDPOINT = 'https://photon.komoot.io/api/';

interface PhotonResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: { street?: string; housenumber?: string; postcode?: string; city?: string; district?: string };
  }>;
}

/** Nur Treffer mit Strasse und Hausnummer; Koordinaten sind [lng, lat]. */
export function parsePhoton(json: PhotonResponse, bbox: BBox): GeocodeResult[] {
  const results: GeocodeResult[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    const c = f.geometry?.coordinates;
    if (!p?.street || !p.housenumber || !c) continue;
    const place = [p.postcode, p.city ?? p.district].filter(Boolean).join(' ');
    const street = `${p.street} ${p.housenumber}`;
    results.push({ label: place ? `${street}, ${place}` : street, lat: c[1], lng: c[0] });
  }
  return filterByBBox(results, bbox);
}

export class PhotonGeocoder implements GeocoderProvider {
  async search(query: string, bbox: BBox, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({ q: query, lang: 'de', limit: '5', bbox: bbox.join(',') });
    const res = await fetch(`${ENDPOINT}?${params}`, { signal });
    if (!res.ok) throw new Error(`photon: HTTP ${res.status}`);
    return parsePhoton((await res.json()) as PhotonResponse, bbox);
  }
}
