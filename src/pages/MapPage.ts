import { contactInfo } from '../components/contactInfo';
import type { Village } from '../config/villages';
import { createMap } from '../components/map';
import { openDialog } from '../components/dialog';
import { openDeleteDialog } from '../components/deleteDialog';
import { openEntryForm } from '../components/entryForm';
import { showToast } from '../components/toast';
import { villageNotice } from '../components/villageNotice';
import { fetchEntries, getEntryByToken } from '../lib/supabase/entries';
import { tokenFor } from '../lib/token';
import type { Entry } from '../lib/types';
import { formatDate, h } from '../lib/dom';

export function renderMapPage(root: HTMLElement, village: Village, deleteToken?: string | null): void {
  root.replaceChildren();
  const mapEl = h('div', { class: 'map', id: 'map' });
  const header = h(
    'header',
    { class: 'topbar' },
    h('h1', {}, `🎃 ${village.name}`),
    village.welcomeText ? h('p', {}, village.welcomeText) : null,
    villageNotice(village),
  );
  root.append(mapEl, header);

  let entries: Entry[] = [];

  function onDeleted(id: string) {
    entries = entries.filter((e) => e.id !== id);
    map.setEntries(entries);
    showToast('Dein Eintrag wurde gelöscht.');
  }

  const map = createMap(mapEl, village, {
    // Eigene Einträge (Token in diesem Browser bekannt) bekommen im Popup einen Löschen-Button
    popupExtras(entry) {
      const token = tokenFor(entry.id);
      if (!token) return null;
      const btn = h('button', { type: 'button', class: 'btn danger small' }, 'Meinen Eintrag löschen');
      btn.addEventListener('click', () => {
        map.map.closePopup();
        openDeleteDialog(entry, token, () => onDeleted(entry.id));
      });
      return btn;
    },
  });

  async function load(manual = false) {
    reloadBtn.disabled = true;
    try {
      entries = await fetchEntries(village);
      map.setEntries(entries);
      if (manual) showToast('Einträge aktualisiert.');
    } catch {
      showToast('Die Einträge konnten nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      reloadBtn.disabled = false;
    }
  }

  const reloadBtn = h('button', { type: 'button', class: 'btn secondary map-btn', 'aria-label': 'Einträge neu laden', title: 'Einträge neu laden' }, '🔄');
  reloadBtn.addEventListener('click', () => void load(true));

  // Eigene Position: wird erst nach dem ersten Klick abgefragt (Berechtigungsdialog nur auf Wunsch)
  let watchId: number | null = null;
  let centerOnFirstFix = false;
  const locateBtn = h('button', { type: 'button', class: 'btn secondary map-btn', 'aria-label': 'Auf meine Position zentrieren', title: 'Auf meine Position zentrieren' }, '📍');
  locateBtn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      showToast('Dein Gerät unterstützt keine Standortbestimmung.');
      return;
    }
    if (watchId !== null) {
      if (!map.centerOnUser()) showToast('Position wird noch bestimmt …');
      return;
    }
    centerOnFirstFix = true;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        map.setUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        if (centerOnFirstFix) {
          centerOnFirstFix = false;
          map.centerOnUser();
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED && watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
          showToast('Standortzugriff verweigert. Bitte erlaube ihn in den Browser-Einstellungen.');
        } else if (err.code !== err.PERMISSION_DENIED) {
          showToast('Deine Position konnte nicht bestimmt werden.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  });

  const addBtn = h('button', { type: 'button', class: 'btn fab' }, '🎃 Meine Adresse eintragen');
  if (!village.active) {
    addBtn.classList.add('inactive');
    addBtn.setAttribute('aria-disabled', 'true');
  }
  addBtn.addEventListener('click', () => {
    if (!village.active) {
      showToast(`Einträge für ${village.name} sind noch nicht freigeschaltet. Bitte kontaktiere Stefan Oderbolz (stefan.oderbolz@metaodi.ch).`);
      return;
    }
    openEntryForm(village, (created) => {
      entries = [...entries, { ...created, village_slug: village.slug, created_at: new Date().toISOString() }];
      map.setEntries(entries);
      map.focus(created);
      map.openPopup(created.id);
    });
  });
  const infoBtn = h('button', { type: 'button', class: 'btn secondary info-btn', 'aria-label': 'Info und Datenschutz' }, 'ℹ️ Info');
  infoBtn.addEventListener('click', () => openDialog('Info und Datenschutz', infoContent(village)));
  root.append(addBtn, infoBtn, h('div', { class: 'map-actions' }, reloadBtn, locateBtn));

  void load();
  if (deleteToken) void startDeleteFlow(deleteToken);

  /** Löschlink (?loeschen=<token>): Eintrag nachschlagen und Bestätigungsdialog zeigen. */
  async function startDeleteFlow(token: string) {
    // Token aus der Adresszeile entfernen, damit er nicht versehentlich weitergeteilt wird
    const url = new URL(window.location.href);
    url.searchParams.delete('loeschen');
    history.replaceState(null, '', url);
    try {
      const entry = await getEntryByToken(token);
      if (!entry || entry.village_slug !== village.slug) {
        showToast('Dieser Eintrag existiert nicht (mehr). Der Löschlink ist nicht mehr gültig.');
        return;
      }
      openDeleteDialog(entry, token, () => onDeleted(entry.id));
    } catch {
      showToast('Der Löschlink konnte nicht geprüft werden. Bitte versuche es später erneut.');
    }
  }
}

function infoContent(village: Village): HTMLElement {
  return h(
    'div',
    {},
    villageNotice(village),
    village.eventDate ? h('p', {}, `Halloween in ${village.name}: ${formatDate(village.eventDate)}.`) : null,
    h('p', {}, 'Familien tragen ihre Adresse selbst ein, wenn bei ihnen an Halloween Trick-or-Treat erwünscht ist.'),
    h('h3', {}, 'Datenschutz'),
    h(
      'ul',
      {},
      h('li', {}, 'Gespeichert werden nur Adresse (Strasse und Nr.) und ein optionaler Hinweis, kein Name.'),
      h('li', {}, 'Beides ist öffentlich auf der Karte sichtbar.'),
      h('li', {}, 'Du kannst deinen Eintrag jederzeit mit deinem persönlichen Löschlink entfernen.'),
      h('li', {}, 'Dein Eintrag bleibt gespeichert, bis du ihn widerrufst (z. B. für das nächste Jahr).'),
    ),
    h('h3', {}, 'Kontakt'),
    contactInfo(),
    h('p', {}, h('a', { href: `${import.meta.env.BASE_URL}?gemeinden` }, '← Alle Gemeinden')),
  );
}
