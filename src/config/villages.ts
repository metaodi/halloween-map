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
  /** Gut sichtbarer Hinweis auf der Karte, im Eintragsformular und im Info-Dialog (z. B. auf eine bestehende Gruppe) */
  notice?: { text: string; link?: { href: string; label: string } };
  /** false = Gemeinde ist noch nicht freigeschaltet: Button ist auf der Übersicht ausgegraut, Tipp zeigt den Kontakthinweis */
  active: boolean;
}

/**
 * Gemeinden am Zürichsee und Umgebung (alphabetisch). Das Zentrum ist ein Näherungswert und sollte
 * beim Freischalten (active: true) geprüft werden. Die bbox ist das PLZ-Gebiet mit etwas Puffer,
 * berechnet mit scripts/fetch-bboxes.ts (PLZ des Orts dort eintragen).
 */
export const villages: Village[] = [
  {
    slug: 'adliswil',
    name: 'Adliswil',
    center: [47.3105, 8.5249],
    zoom: 14,
    bbox: [8.5, 47.284, 8.544, 47.333],
    active: true,
  },
  {
    // Ortsteil von Wädenswil
    slug: 'au',
    name: 'Au (Wädenswil)',
    center: [47.249, 8.65],
    zoom: 14,
    bbox: [8.625, 47.233, 8.682, 47.264],
    active: true,
  },
  {
    slug: 'hirzel',
    name: 'Hirzel',
    center: [47.2131, 8.6],
    zoom: 14,
    bbox: [8.572, 47.197, 8.632, 47.242],
    active: false,
  },
  {
    slug: 'horgen',
    name: 'Horgen',
    center: [47.2594, 8.5988],
    zoom: 14,
    bbox: [8.572, 47.22, 8.636, 47.279],
    active: true,
  },
  {
    // Kanton Zug
    slug: 'huenenberg',
    name: 'Hünenberg',
    center: [47.1757, 8.4258],
    zoom: 14,
    bbox: [8.391, 47.151, 8.464, 47.251],
    active: true,
  },
  {
    slug: 'kilchberg',
    name: 'Kilchberg',
    center: [47.3235, 8.5446],
    zoom: 14,
    bbox: [8.531, 47.307, 8.569, 47.344],
    active: false,
  },
  {
    slug: 'langnau-am-albis',
    name: 'Langnau am Albis',
    center: [47.2899, 8.5372],
    zoom: 14,
    bbox: [8.501, 47.234, 8.581, 47.303],
    active: false,
  },
  {
    slug: 'oberrieden',
    name: 'Oberrieden',
    center: [47.2706, 8.5758],
    zoom: 14,
    bbox: [8.551, 47.26, 8.603, 47.289],
    active: false,
  },
  {
    slug: 'richterswil',
    name: 'Richterswil',
    center: [47.201, 8.6994],
    zoom: 14,
    bbox: [8.676, 47.194, 8.743, 47.234],
    active: true,
    eventDate: '2026-10-31',
    welcomeText: 'Hier siehst du, wo an Halloween Trick-or-Treat erwünscht ist.',
  },
  {
    slug: 'rueschlikon',
    name: 'Rüschlikon',
    center: [47.307, 8.5555],
    zoom: 14,
    bbox: [8.528, 47.291, 8.577, 47.321],
    active: true,
  },
  {
    slug: 'thalwil',
    name: 'Thalwil',
    center: [47.2928, 8.5659],
    zoom: 14,
    bbox: [8.545, 47.274, 8.593, 47.309],
    active: true,
    notice: {
      text: 'Für Thalwil gibt es auch die Facebook-Gruppe «Thalwil Halloween 2026» mit einer eigenen Karte. Schau auch dort vorbei!',
      link: { href: 'https://www.facebook.com/groups/299732252995490/', label: 'Zur Facebook-Gruppe' },
    },
  },
  {
    slug: 'waedenswil',
    name: 'Wädenswil',
    center: [47.2299, 8.672],
    zoom: 14,
    bbox: [8.614, 47.197, 8.705, 47.248],
    active: true,
  },
  {
    // Kanton Schwyz
    slug: 'wollerau',
    name: 'Wollerau',
    center: [47.1953, 8.7253],
    zoom: 14,
    bbox: [8.678, 47.174, 8.758, 47.205],
    active: true,
  },
  {
    // Quartier der Stadt Zürich (Kreis 2)
    slug: 'wollishofen',
    name: 'Wollishofen (Zürich)',
    center: [47.3406, 8.5336],
    zoom: 14,
    bbox: [8.517, 47.325, 8.557, 47.356],
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
