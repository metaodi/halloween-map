import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Village } from '../config/villages';
import type { Entry } from '../lib/types';
import { h } from '../lib/dom';

export interface MapHandle {
  map: L.Map;
  setEntries(entries: Entry[]): void;
  focus(entry: Pick<Entry, 'lat' | 'lng'>): void;
  openPopup(entryId: string): void;
  /** Zoomt auf alle Einträge, ohne Einträge auf die Mitte des Orts. */
  fit(entries: Entry[], fallback: Village): void;
  /** Dunkelt das Gebiet ausserhalb der bbox des Orts ab; null entfernt die Anzeige. */
  setBounds(village: Pick<Village, 'bbox'> | null): void;
  /** Zeigt die eigene Position (Punkt + Genauigkeitskreis) an. */
  setUserLocation(lat: number, lng: number, accuracy: number): void;
  /** Zentriert die Karte auf die zuletzt bekannte eigene Position; false, wenn keine bekannt ist. */
  centerOnUser(): boolean;
}

export interface MapOptions {
  /** Liefert zusätzliche Inhalte (z. B. «Meinen Eintrag löschen») für das Popup eines Eintrags. */
  popupExtras?: (entry: Entry) => Node | null;
}

const pumpkinIcon = L.divIcon({
  className: 'pumpkin-marker',
  html: '<span aria-hidden="true">🎃</span>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -18],
});

export function createMap(container: HTMLElement, village: Village, options: MapOptions = {}): MapHandle {
  const map = L.map(container, { zoomControl: false }).setView(village.center, village.zoom);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // «Swiss style» von OSM Switzerland (wie in uMap)
  L.tileLayer('https://tile.osm.ch/switzerland/{z}/{x}/{y}.png', {
    maxZoom: 21,
    maxNativeZoom: 18,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, ' +
      'Style <a href="https://osm.ch">OSM Switzerland</a>',
  }).addTo(map);

  const layer = L.layerGroup().addTo(map);
  const markers = new Map<string, L.Marker>();

  function popupContent(entry: Entry): HTMLElement {
    const root = h('div', { class: 'popup' }, h('strong', {}, entry.address_label));
    if (entry.note) root.append(h('p', { class: 'popup-note' }, entry.note));
    const extras = options.popupExtras?.(entry);
    if (extras) root.append(extras);
    return root;
  }

  // Gebiet ausserhalb der bbox abdunkeln: Weltrechteck mit Loch in Form der bbox
  let boundsLayer: L.Polygon | null = null;
  function setBounds(v: Pick<Village, 'bbox'> | null) {
    boundsLayer?.remove();
    boundsLayer = null;
    if (!v) return;
    const [minLng, minLat, maxLng, maxLat] = v.bbox;
    const world: L.LatLngTuple[] = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
    const hole: L.LatLngTuple[] = [[minLat, minLng], [minLat, maxLng], [maxLat, maxLng], [maxLat, minLng]];
    boundsLayer = L.polygon([world, hole], {
      interactive: false,
      stroke: true,
      color: '#f97316',
      weight: 2,
      fillColor: '#000',
      fillOpacity: 0.35,
    }).addTo(map);
  }
  setBounds(village);

  let userDot: L.CircleMarker | null = null;
  let userAccuracy: L.Circle | null = null;
  let userLatLng: L.LatLng | null = null;

  return {
    map,
    setBounds,
    setUserLocation(lat, lng, accuracy) {
      userLatLng = L.latLng(lat, lng);
      if (!userDot || !userAccuracy) {
        userAccuracy = L.circle(userLatLng, { radius: accuracy, interactive: false, weight: 1, color: '#2563eb', fillOpacity: 0.12 }).addTo(map);
        userDot = L.circleMarker(userLatLng, {
          radius: 8, weight: 3, color: '#fff', fillColor: '#2563eb', fillOpacity: 1, interactive: false,
        }).addTo(map);
      } else {
        userAccuracy.setLatLng(userLatLng).setRadius(accuracy);
        userDot.setLatLng(userLatLng);
      }
    },
    centerOnUser() {
      if (!userLatLng) return false;
      map.setView(userLatLng, Math.max(map.getZoom(), 17));
      return true;
    },
    setEntries(entries) {
      layer.clearLayers();
      markers.clear();
      for (const entry of entries) {
        const marker = L.marker([entry.lat, entry.lng], {
          icon: pumpkinIcon,
          title: entry.address_label,
          alt: `Trick-or-Treat bei ${entry.address_label}`,
        });
        marker.bindPopup(() => popupContent(entry));
        marker.addTo(layer);
        markers.set(entry.id, marker);
      }
    },
    focus(entry) {
      map.setView([entry.lat, entry.lng], Math.max(map.getZoom(), 17));
    },
    openPopup(entryId) {
      markers.get(entryId)?.openPopup();
    },
    fit(entries, fallback) {
      if (entries.length === 0) {
        map.setView(fallback.center, fallback.zoom);
      } else {
        map.fitBounds(L.latLngBounds(entries.map((e) => [e.lat, e.lng] as [number, number])), { padding: [40, 40], maxZoom: 17 });
      }
    },
  };
}
