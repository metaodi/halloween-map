import type { Entry } from './types';

/** Dummy-Daten, solange kein Supabase konfiguriert ist (nur für die lokale Entwicklung). */
export function demoEntries(villageSlug: string, center: [number, number]): Entry[] {
  const samples: Array<[string, number, number, string | null]> = [
    ['Seestrasse 12, 8700 Küsnacht', 0.004, -0.006, 'ab 17 Uhr, bitte klingeln'],
    ['Dorfstrasse 3, 8700 Küsnacht', -0.003, 0.002, null],
    ['Bergstrasse 27, 8700 Küsnacht', 0.007, 0.009, 'Süsses und Saures!'],
    ['Weinbergweg 5, 8700 Küsnacht', -0.008, -0.004, 'ab 18 Uhr'],
    ['Rebhalde 9, 8700 Küsnacht', 0.001, 0.014, null],
  ];
  return samples.map(([address_label, dLat, dLng, note], i) => ({
    id: `demo-${i}`,
    village_slug: villageSlug,
    address_label,
    lat: center[0] + dLat,
    lng: center[1] + dLng,
    note,
    created_at: new Date().toISOString(),
  }));
}
