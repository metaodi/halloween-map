import { describe, expect, it } from 'vitest';
import { isInBBox } from './bbox';
import { parsePhoton } from './photon';
import { cleanSwisstopoLabel, parseSwisstopo } from './swisstopo';
import type { BBox } from './types';

const bbox: BBox = [8.55, 47.25, 8.72, 47.35];

describe('swisstopo', () => {
  it('bereinigt das HTML-Label', () => {
    expect(cleanSwisstopoLabel('Seestrasse 12 <b>8700 Küsnacht</b>')).toBe('Seestrasse 12, 8700 Küsnacht');
    expect(cleanSwisstopoLabel('Route 1234 5 <b>8700 Küsnacht</b>')).toBe('Route 1234 5, 8700 Küsnacht');
  });

  it('parst Treffer und verwirft solche ausserhalb der bbox oder ohne Koordinaten', () => {
    const results = parseSwisstopo(
      {
        results: [
          { attrs: { label: 'Seestrasse 12 <b>8700 Küsnacht</b>', lat: 47.31, lon: 8.58 } },
          { attrs: { label: 'Bundesplatz 1 <b>3003 Bern</b>', lat: 46.946, lon: 7.444 } },
          { attrs: { label: 'Ohne Koordinaten' } },
        ],
      },
      bbox,
    );
    expect(results).toEqual([{ label: 'Seestrasse 12, 8700 Küsnacht', lat: 47.31, lng: 8.58 }]);
  });

  it('kommt mit leerer Antwort zurecht', () => {
    expect(parseSwisstopo({}, bbox)).toEqual([]);
  });
});

describe('photon', () => {
  it('liest [lng, lat], formatiert das Label und verlangt Strasse + Nr.', () => {
    const results = parsePhoton(
      {
        features: [
          {
            geometry: { coordinates: [8.58, 47.31] },
            properties: { street: 'Seestrasse', housenumber: '12', postcode: '8700', city: 'Küsnacht' },
          },
          { geometry: { coordinates: [8.58, 47.31] }, properties: { street: 'Seestrasse', city: 'Küsnacht' } },
          {
            geometry: { coordinates: [7.44, 46.95] },
            properties: { street: 'Bundesplatz', housenumber: '1', postcode: '3003', city: 'Bern' },
          },
        ],
      },
      bbox,
    );
    expect(results).toEqual([{ label: 'Seestrasse 12, 8700 Küsnacht', lat: 47.31, lng: 8.58 }]);
  });
});

describe('isInBBox', () => {
  it('prüft die Grenzen inklusive', () => {
    expect(isInBBox(47.3, 8.6, bbox)).toBe(true);
    expect(isInBBox(47.25, 8.55, bbox)).toBe(true);
    expect(isInBBox(47.2, 8.6, bbox)).toBe(false);
    expect(isInBBox(47.3, 9.0, bbox)).toBe(false);
  });
});

describe('bboxToLv95', () => {
  it('rechnet Richterswil korrekt nach LV95 um', async () => {
    const { bboxToLv95 } = await import('./swisstopo');
    const [e, n] = bboxToLv95([8.6994, 47.201, 8.6994, 47.201]);
    expect(e).toBeGreaterThan(2695000);
    expect(e).toBeLessThan(2696000);
    expect(n).toBeGreaterThan(1228000);
    expect(n).toBeLessThan(1230000);
  });
});
