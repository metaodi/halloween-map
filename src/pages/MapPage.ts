import type { Village } from '../config/villages';
import { createMap } from '../components/map';
import { openEntryForm } from '../components/entryForm';
import { showToast } from '../components/toast';
import { fetchEntries } from '../lib/supabase/entries';
import type { Entry } from '../lib/types';
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
  let entries: Entry[] = [];

  async function load() {
    try {
      entries = await fetchEntries(village);
      map.setEntries(entries);
    } catch {
      showToast('Die Einträge konnten nicht geladen werden. Bitte Seite neu laden.');
    }
  }

  const addBtn = h('button', { type: 'button', class: 'btn fab' }, '🎃 Meine Adresse eintragen');
  addBtn.addEventListener('click', () =>
    openEntryForm(village, (created) => {
      entries = [...entries, { ...created, village_slug: village.slug, created_at: new Date().toISOString() }];
      map.setEntries(entries);
      map.focus(created);
      map.openPopup(created.id);
    }),
  );
  root.append(addBtn);

  void load();
}
