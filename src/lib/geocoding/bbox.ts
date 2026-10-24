import type { BBox, GeocodeResult } from './types';

export function isInBBox(lat: number, lng: number, bbox: BBox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

export function filterByBBox(results: GeocodeResult[], bbox: BBox): GeocodeResult[] {
  return results.filter((r) => isInBBox(r.lat, r.lng, bbox));
}
