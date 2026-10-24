import type { Village } from '../config/villages';
import { createMap } from '../components/map';
import { fetchEntries } from '../lib/supabase/entries';
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

  const status = h('div', { class: 'toast', role: 'status' });
  root.append(status);
  fetchEntries(village)
    .then((entries) => map.setEntries(entries))
    .catch(() => {
      status.textContent = 'Die Einträge konnten nicht geladen werden. Bitte Seite neu laden.';
      status.classList.add('visible');
    });
}
