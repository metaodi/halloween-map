/** [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number];

export interface GeocodeResult {
  /** Anzeigetext, wird als address_label gespeichert, z. B. «Seestrasse 12, 8700 Küsnacht» */
  label: string;
  lat: number;
  lng: number;
}

export interface GeocoderProvider {
  /** Sucht Adressen. Treffer ausserhalb der bbox werden nicht zurückgegeben. */
  search(query: string, bbox: BBox, signal?: AbortSignal): Promise<GeocodeResult[]>;
}
