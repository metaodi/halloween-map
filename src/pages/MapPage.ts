import type { Village } from '../config/villages';
import { createMap } from '../components/map';
import { demoEntries } from '../lib/demoData';
import { h } from '../lib/dom';

export function renderMapPage(root: HTMLElement, village: Village): void {
  root.replaceChildren();
  const mapEl = h('div', { class: 'map', id: 'map' });
  const header = h(
    'header',
    { class: 'topbar' },
    h('h1', {}, `🎃 ${village.name}`),
    village.welcomeText ? h('p', {}, village.welcomeText) : null,
  );
  root.append(mapEl, header);

  const map = createMap(mapEl, village);
  map.setEntries(demoEntries(village.slug, village.center));
}
