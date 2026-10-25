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
  /** false = Gemeinde ist noch nicht freigeschaltet: Button ist auf der Übersicht ausgegraut, Tipp zeigt den Kontakthinweis */
  active: boolean;
}

/**
 * Gemeinden des Bezirks Horgen (alphabetisch). Zentrum und bbox sind Näherungswerte und
 * sollten beim Freischalten (active: true) geprüft werden.
 */
export const villages: Village[] = [
  {
    slug: 'adliswil',
    name: 'Adliswil',
    center: [47.3105, 8.5249],
    zoom: 14,
    bbox: [8.495, 47.285, 8.555, 47.335],
    active: false,
  },
  {
    // Ortsteil von Wädenswil
    slug: 'au',
    name: 'Au (Wädenswil)',
    center: [47.2505, 8.6425],
    zoom: 15,
    bbox: [8.605, 47.215, 8.655, 47.25],
    active: true,
  },
  {
    slug: 'hirzel',
    name: 'Hirzel',
    center: [47.2131, 8.6],
    zoom: 14,
    bbox: [8.565, 47.185, 8.64, 47.24],
    active: false,
  },
  {
    slug: 'horgen',
    name: 'Horgen',
    center: [47.2594, 8.5988],
    zoom: 14,
    bbox: [8.56, 47.23, 8.65, 47.29],
    active: true,
  },
  {
    slug: 'kilchberg',
    name: 'Kilchberg',
    center: [47.3235, 8.5446],
    zoom: 14,
    bbox: [8.525, 47.305, 8.565, 47.34],
    active: false,
  },
  {
    slug: 'langnau-am-albis',
    name: 'Langnau am Albis',
    center: [47.2899, 8.5372],
    zoom: 14,
    bbox: [8.505, 47.25, 8.57, 47.32],
    active: false,
  },
  {
    slug: 'oberrieden',
    name: 'Oberrieden',
    center: [47.2706, 8.5758],
    zoom: 14,
    bbox: [8.555, 47.255, 8.6, 47.29],
    active: false,
  },
  {
    slug: 'richterswil',
    name: 'Richterswil',
    center: [47.201, 8.6994],
    zoom: 14,
    bbox: [8.678, 47.181, 8.71, 47.224],
    active: true,
    eventDate: '2026-10-31',
    welcomeText: 'Hier siehst du, wo an Halloween Trick-or-Treat erwünscht ist.',
  },
  {
    slug: 'rueschlikon',
    name: 'Rüschlikon',
    center: [47.307, 8.5555],
    zoom: 14,
    bbox: [8.535, 47.29, 8.585, 47.325],
    active: true,
  },
  {
    slug: 'thalwil',
    name: 'Thalwil',
    center: [47.2928, 8.5659],
    zoom: 14,
    bbox: [8.54, 47.27, 8.6, 47.315],
    active: false,
  },
  {
    slug: 'waedenswil',
    name: 'Wädenswil',
    center: [47.2299, 8.672],
    zoom: 14,
    bbox: [8.6, 47.19, 8.73, 47.27],
    active: true,
  },
];

export function findVillage(slug: string | null | undefined): Village | undefined {
  if (!slug) return undefined;
  return villages.find((v) => v.slug === slug);
}

export function defaultVillage(): Village | undefined {
  return findVillage(import.meta.env.VITE_DEFAULT_VILLAGE as string | undefined);
}
