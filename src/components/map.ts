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
 * - `mist`: ausgefranster dunkler Nebel ausserhalb des Orts, darüber ziehende Nebelschwaden
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

const MIST_FILTER_ID = 'village-mist-filter';

/** Maximale Verschiebung des Rands durch den Filter (scale / 2) */
const MIST_WARP_PX = 70;

/**
 * SVG-Filter für den dunklen Nebel, einmal pro Dokument. Der Filter arbeitet in Layer-Pixeln:
 * beim Verschieben bleibt das Muster an der Karte «kleben», beim Zoomen bildet es sich neu.
 * Er wird nur bei Pan-Ende/Zoom neu gerechnet, nicht pro Frame.
 */
function ensureMistFilter(): void {
  if (document.getElementById(MIST_FILTER_ID)) return;
  const holder = document.createElement('div');
  holder.innerHTML = `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
      <filter id="${MIST_FILTER_ID}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <!-- Rand ausfransen: grobes Rauschen verschiebt die Kante um bis zu ±${MIST_WARP_PX} px -->
        <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="7" result="warp"/>
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="${MIST_WARP_PX * 2}" xChannelSelector="R" yChannelSelector="G" result="shape"/>
        <feGaussianBlur in="shape" stdDeviation="16" result="soft"/>
        <!-- Wolkige Dichte: Rauschen als Alphamaske (ca. 65–100 %) -->
        <feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="3" seed="3" result="clouds"/>
        <feColorMatrix in="clouds" type="matrix" result="cloudAlpha"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 0.25"/>
        <feComposite in="soft" in2="cloudAlpha" operator="in"/>
      </filter>
    </svg>`;
  document.body.append(holder.firstElementChild!);
}

/** Breite des weichen Übergangs (px) der Nebelschwaden am Ortsrand */
const WISP_FADE_PX = 70;

/**
 * Ziehende, helle Nebelschwaden über dem dunklen Nebel. Die Ebene liegt bildschirmfest in einer
 * eigenen Pane; die Bewegung ist eine reine CSS-Animation (transform) einer kachelbaren
 * Rauschtextur (style.css, `.village-wisps`). Eine CSS-Maske blendet sie über dem Ort aus und
 * wird beim Verschieben nachgeführt. Während Zoom-Animationen ist sie per CSS ausgeblendet.
 */
function createWisps(map: L.Map): { setBBox(bbox: Village['bbox'] | null): void } {
  const pane = map.createPane('village-wisps');
  const root = L.DomUtil.create('div', 'village-wisps', pane);
  root.setAttribute('aria-hidden', 'true');
  L.DomUtil.create('div', 'village-wisps-far', root);
  L.DomUtil.create('div', 'village-wisps-near', root);
  let bbox: Village['bbox'] | null = null;

  function update() {
    root.hidden = !bbox;
    if (!bbox) return;
    const size = map.getSize();
    // bildschirmfest: Gegenbewegung zur Karte
    L.DomUtil.setPosition(root, map.containerPointToLayerPoint([0, 0]));
    root.style.width = `${size.x}px`;
    root.style.height = `${size.y}px`;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const nw = map.latLngToContainerPoint([maxLat, minLng]);
    const se = map.latLngToContainerPoint([minLat, maxLng]);
    const f = WISP_FADE_PX;
    // Vereinigung zweier Verläufe = alles ausserhalb des Rechtecks, mit weichem Übergang
    const mask =
      `linear-gradient(to right, #000 ${nw.x - f}px, transparent ${nw.x}px, transparent ${se.x}px, #000 ${se.x + f}px), ` +
      `linear-gradient(to bottom, #000 ${nw.y - f}px, transparent ${nw.y}px, transparent ${se.y}px, #000 ${se.y + f}px)`;
    root.style.setProperty('-webkit-mask-image', mask);
    root.style.setProperty('mask-image', mask);
  }
  map.on('move zoom resize viewreset', update);

  return {
    setBBox(b) {
      bbox = b;
      update();
    },
  };
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

  let mistRenderer: L.Renderer | undefined;
  let wisps: ReturnType<typeof createWisps> | undefined;
  if (boundsStyle === 'mist') {
    ensureMistFilter();
    // Eigene Pane unter den Markern; grosses Padding, damit der Filter am Bildschirmrand nicht ausfranst
    map.createPane('village-mist');
    mistRenderer = L.svg({ pane: 'village-mist', padding: 0.5 });
    wisps = createWisps(map);
  }

  function setBounds(v: Pick<Village, 'bbox'> | null) {
    for (const p of boundsLayers) p.remove();
    boundsLayers = [];
    wisps?.setBBox(v?.bbox ?? null);
    if (!v) return;
    const rings = [world, holeRing(v.bbox)];
    if (boundsStyle === 'outline') {
      boundsLayers = [
        L.polygon(rings, { interactive: false, stroke: true, color: '#f97316', weight: 2, fillColor: '#000', fillOpacity: 0.35 }).addTo(map),
      ];
      return;
    }
    const polygon = L.polygon(rings, {
      interactive: false,
      stroke: false,
      renderer: mistRenderer,
      fillColor: FOG_COLOR,
      fillOpacity: 0.75,
    }).addTo(map);
    polygon.getElement()?.setAttribute('filter', `url(#${MIST_FILTER_ID})`);
    boundsLayers = [polygon];
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
