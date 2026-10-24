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
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
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

  return {
    map,
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
  };
}
