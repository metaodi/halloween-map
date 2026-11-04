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

/**
 * Darstellung der Ortsgrenze:
 * - `outline`: harte orange Linie, aussen leicht abgedunkelt (Admin)
 * - `mist`: ausgefranste, langsam wabernde Nebelschwaden ausserhalb des Orts
 */
export type BoundsStyle = 'outline' | 'mist';

export interface MapOptions {
  /** Default: `mist` */
  boundsStyle?: BoundsStyle;
  /** Liefert zusätzliche Inhalte (z. B. «Meinen Eintrag löschen») für das Popup eines Eintrags. */
  popupExtras?: (entry: Entry) => Node | null;
  /** Eigene Einträge werden mit einem grünen Kürbis dargestellt. */
  isOwn?: (entry: Entry) => boolean;
}

const pumpkinIcon = L.divIcon({
  className: 'pumpkin-marker',
  html: '<span aria-hidden="true">🎃</span>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -18],
});

const ownPumpkinIcon = L.divIcon({
  className: 'pumpkin-marker own',
  html: '<span aria-hidden="true">🎃</span>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -18],
});

/** Nacht-Violett, passend zu --bg */
const FOG_COLOR = '#140a24';

/**
 * Zwei Nebelschichten mit unterschiedlichem Rauschen. Per CSS (style.css, `.village-mist-pane`)
 * werden sie gegeneinander überblendet und leicht verschoben: so wabert der Nebel, ohne dass
 * der teure SVG-Filter pro Frame neu gerechnet werden muss (nur Opacity/Transform der Pane).
 */
const MIST_LAYERS = [
  { name: 'village-mist-a', warpSeed: 7, cloudSeed: 3 },
  { name: 'village-mist-b', warpSeed: 23, cloudSeed: 41 },
] as const;

/** Maximale Verschiebung des Rands durch den Filter (scale / 2) */
const MIST_WARP_PX = 70;

/**
 * SVG-Filter für die Nebelschwaden, einmal pro Dokument. Der Filter arbeitet in Layer-Pixeln:
 * beim Verschieben bleibt das Muster an der Karte «kleben», beim Zoomen bildet es sich neu.
 */
function ensureMistFilters(): void {
  if (document.getElementById(MIST_LAYERS[0].name)) return;
  const filters = MIST_LAYERS.map(
    (l) => `
      <filter id="${l.name}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <!-- Rand ausfransen: grobes Rauschen verschiebt die Kante um bis zu ±${MIST_WARP_PX} px -->
        <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="${l.warpSeed}" result="warp"/>
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="${MIST_WARP_PX * 2}" xChannelSelector="R" yChannelSelector="G" result="shape"/>
        <feGaussianBlur in="shape" stdDeviation="16" result="soft"/>
        <!-- Wolkige Dichte: Rauschen als Alphamaske (ca. 65–100 %) -->
        <feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="3" seed="${l.cloudSeed}" result="clouds"/>
        <feColorMatrix in="clouds" type="matrix" result="cloudAlpha"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 0.25"/>
        <feComposite in="soft" in2="cloudAlpha" operator="in"/>
      </filter>`,
  ).join('');
  const holder = document.createElement('div');
  holder.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${filters}</svg>`;
  document.body.append(holder.firstElementChild!);
}

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
  const boundsStyle = options.boundsStyle ?? 'mist';
  const world: L.LatLngTuple[] = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
  let boundsLayers: L.Polygon[] = [];

  /** Loch in Form der bbox. Beim Nebel franst der Rand bewusst auch etwas in den Ort hinein. */
  function holeRing([minLng, minLat, maxLng, maxLat]: Village['bbox']): L.LatLngTuple[] {
    return [[minLat, minLng], [minLat, maxLng], [maxLat, maxLng], [maxLat, minLng]];
  }

  const mistRenderers: L.Renderer[] = [];
  if (boundsStyle === 'mist') {
    ensureMistFilters();
    for (const l of MIST_LAYERS) {
      // Eigene Pane unter den Markern; grosses Padding, damit Filter und Drift am Bildschirmrand nicht ausfransen
      const pane = map.createPane(l.name);
      pane.classList.add('village-mist-pane');
      mistRenderers.push(L.svg({ pane: l.name, padding: 0.5 }));
    }
  }

  function setBounds(v: Pick<Village, 'bbox'> | null) {
    for (const p of boundsLayers) p.remove();
    boundsLayers = [];
    if (!v) return;
    const rings = [world, holeRing(v.bbox)];
    if (boundsStyle === 'outline') {
      boundsLayers = [
        L.polygon(rings, { interactive: false, stroke: true, color: '#f97316', weight: 2, fillColor: '#000', fillOpacity: 0.35 }).addTo(map),
      ];
      return;
    }
    boundsLayers = MIST_LAYERS.map((l, i) => {
      const polygon = L.polygon(rings, {
        interactive: false,
        stroke: false,
        renderer: mistRenderers[i],
        fillColor: FOG_COLOR,
        fillOpacity: 0.6,
      }).addTo(map);
      polygon.getElement()?.setAttribute('filter', `url(#${l.name})`);
      return polygon;
    });
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
          icon: options.isOwn?.(entry) ? ownPumpkinIcon : pumpkinIcon,
          zIndexOffset: options.isOwn?.(entry) ? 1000 : 0,
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
