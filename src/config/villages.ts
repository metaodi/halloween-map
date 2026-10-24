/**
 * Konfiguration der Orte. Einen neuen Ort hinzufügen = einen Eintrag ergänzen.
 * Aufruf der Seite: /?ort=<slug>
 */
export interface Village {
  /** URL-tauglicher Bezeichner, wird auch in der DB (village_slug) gespeichert: a-z, 0-9, Bindestrich */
  slug: string;
  name: string;
  /** [lat, lng] */
  center: [number, number];
  zoom: number;
  /** [minLng, minLat, maxLng, maxLat] – Geocoding-Bias und Validierung der Treffer */
  bbox: [number, number, number, number];
  /** ISO-Datum (YYYY-MM-DD) */
  eventDate?: string;
  welcomeText?: string;
}

export const villages: Village[] = [
  {
    // Platzhalter – Werte bitte anpassen
    slug: 'richterswil',
    name: 'Richterswil',
    center: [47.2010, 8.6994],
    zoom: 14,
    bbox: [8.678, 47.181, 8.71, 47.224],
    eventDate: '2026-10-31',
    welcomeText: 'Hier siehst du, wo an Halloween Trick-or-Treat erwünscht ist.',
  },
];

export function findVillage(slug: string | null | undefined): Village | undefined {
  if (!slug) return undefined;
  return villages.find((v) => v.slug === slug);
}

export function defaultVillage(): Village | undefined {
  return findVillage(import.meta.env.VITE_DEFAULT_VILLAGE as string | undefined);
}
