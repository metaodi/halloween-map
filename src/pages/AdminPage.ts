import { createAddressAutocomplete } from '../components/addressAutocomplete';
import { confirmDialog } from '../components/confirmDialog';
import { openDialog } from '../components/dialog';
import { createMap, type MapHandle } from '../components/map';
import { showToast } from '../components/toast';
import { findVillage, villages } from '../config/villages';
import { formatDateTime, h } from '../lib/dom';
import { createGeocoder } from '../lib/geocoding';
import type { BBox } from '../lib/geocoding';
import { supabase } from '../lib/supabase/client';
import {
  currentUserId,
  deleteEntryAsAdmin,
  fetchAllEntries,
  isAdmin,
  signIn,
  signOut,
  updateEntry,
} from '../lib/supabase/admin';
import { deleteMessage, fetchAllMessages, setMessageSticky } from '../lib/supabase/messages';
import type { Entry, Message } from '../lib/types';

const SWITZERLAND: BBox = [5.9, 45.8, 10.5, 47.9];

export async function renderAdminPage(root: HTMLElement): Promise<void> {
  document.title = 'HalloweenKarte Admin';
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex';
  document.head.append(robots);

  if (!supabase) {
    root.replaceChildren(page(h('p', {}, 'Supabase ist nicht konfiguriert (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')));
    return;
  }
  const userId = await currentUserId();
  if (!userId) return renderLogin(root);
  try {
    if (!(await isAdmin(userId))) return renderForbidden(root);
  } catch {
    root.replaceChildren(page(h('p', { role: 'alert' }, 'Die Berechtigung konnte nicht geprüft werden.')));
    return;
  }
  await renderDashboard(root);
}

function page(...children: Node[]): HTMLElement {
  return h('main', { class: 'page admin' }, h('h1', {}, '🎃 HalloweenKarte Admin'), ...children);
}

function renderLogin(root: HTMLElement): void {
  const email = h('input', { id: 'login-email', type: 'email', required: true, autocomplete: 'username' });
  const password = h('input', { id: 'login-password', type: 'password', required: true, autocomplete: 'current-password' });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn' }, 'Anmelden');
  const form = h(
    'form',
    { class: 'login' },
    h('div', { class: 'field' }, h('label', { for: 'login-email' }, 'E-Mail'), email),
    h('div', { class: 'field' }, h('label', { for: 'login-password' }, 'Passwort'), password),
    error,
    submit,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    error.textContent = '';
    try {
      await signIn(email.value, password.value);
      await renderAdminPage(root);
    } catch {
      error.textContent = 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.';
      submit.disabled = false;
    }
  });
  root.replaceChildren(page(form));
  email.focus();
}

function renderForbidden(root: HTMLElement): void {
  const logout = h('button', { type: 'button', class: 'btn secondary' }, 'Abmelden');
  logout.addEventListener('click', async () => {
    await signOut();
    await renderAdminPage(root);
  });
  root.replaceChildren(page(h('p', { role: 'alert' }, 'Dieses Konto hat keine Admin-Berechtigung.'), logout));
}

async function renderDashboard(root: HTMLElement): Promise<void> {
  let all: Entry[];
  const messagesResult = fetchAllMessages().then(
    (m) => m,
    () => null,
  );
  try {
    all = await fetchAllEntries();
  } catch {
    root.replaceChildren(page(h('p', { role: 'alert' }, 'Die Einträge konnten nicht geladen werden.')));
    return;
  }
  // null = Laden fehlgeschlagen (z. B. Migration für Nachrichten noch nicht eingespielt)
  let allMessages: Message[] | null = await messagesResult;

  let filter = '';
  const select = h('select', { id: 'village-filter' });
  const logout = h('button', { type: 'button', class: 'btn secondary' }, 'Abmelden');
  logout.addEventListener('click', async () => {
    await signOut();
    await renderAdminPage(root);
  });
  const mapEl = h('div', { class: 'admin-map' });
  const tbody = h('tbody');
  const count = h('p', { class: 'field-hint', role: 'status' });

  const table = h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      {},
      h('caption', { class: 'sr-only' }, 'Alle Einträge'),
      h(
        'thead',
        {},
        h('tr', {}, ...['Ort', 'Adresse', 'Hinweis', 'Erstellt', 'Aktionen'].map((t) => h('th', { scope: 'col' }, t))),
      ),
      tbody,
    ),
  );

  const messagesBody = h('tbody');
  const messagesCount = h('p', { class: 'field-hint', role: 'status' });
  const messagesTable = h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      {},
      h('caption', { class: 'sr-only' }, 'Alle Nachrichten'),
      h(
        'thead',
        {},
        h('tr', {}, ...['Ort', 'Name', 'Nachricht', 'Erstellt', 'Aktionen'].map((t) => h('th', { scope: 'col' }, t))),
      ),
      messagesBody,
    ),
  );

  root.replaceChildren(
    page(
      h(
        'div',
        { class: 'admin-toolbar' },
        h('div', { class: 'field inline' }, h('label', { for: 'village-filter' }, 'Ort'), select),
        logout,
      ),
      h('h2', {}, 'Einträge'),
      mapEl,
      count,
      table,
      h('h2', { class: 'admin-section' }, 'Nachrichten'),
      allMessages === null
        ? h('p', { role: 'alert' }, 'Die Nachrichten konnten nicht geladen werden. Ist die Migration für Nachrichten eingespielt?')
        : h('div', {}, messagesCount, messagesTable),
    ),
  );

  const startVillage = villages[0];
  const map: MapHandle = createMap(mapEl, startVillage);
  map.setBounds(null); // erst bei Auswahl eines Orts anzeigen

  function slugs(): string[] {
    return [
      ...new Set([...villages.map((v) => v.slug), ...all.map((e) => e.village_slug), ...(allMessages ?? []).map((m) => m.village_slug)]),
    ];
  }
  select.replaceChildren(
    h('option', { value: '' }, 'Alle Orte'),
    ...slugs().map((s) => h('option', { value: s }, findVillage(s)?.name ?? s)),
  );
  select.addEventListener('change', () => {
    filter = select.value;
    refresh(true);
  });

  function visible(): Entry[] {
    return filter ? all.filter((e) => e.village_slug === filter) : all;
  }

  function refresh(refit: boolean) {
    const entries = visible();
    map.setEntries(entries);
    if (refit) map.setBounds(findVillage(filter) ?? null);
    if (refit) map.fit(entries, findVillage(filter) ?? startVillage);
    count.textContent = `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}`;
    tbody.replaceChildren(...entries.map(row));
    refreshMessages();
  }

  function refreshMessages() {
    if (!allMessages) return;
    // Pro Ort: angeheftete zuerst, sonst neueste zuerst (wie auf der Karte)
    const messages = (filter ? allMessages.filter((m) => m.village_slug === filter) : allMessages)
      .slice()
      .sort((a, b) => Number(b.is_sticky) - Number(a.is_sticky) || b.created_at.localeCompare(a.created_at));
    messagesCount.textContent = `${messages.length} ${messages.length === 1 ? 'Nachricht' : 'Nachrichten'}`;
    messagesBody.replaceChildren(...messages.map(messageRow));
  }

  function messageRow(message: Message): HTMLElement {
    const pin = h('button', { type: 'button', class: 'btn secondary small' }, message.is_sticky ? 'Lösen' : '📌 Anheften');
    pin.setAttribute('aria-label', `Nachricht von ${message.author_name} ${message.is_sticky ? 'lösen' : 'anheften'}`);
    pin.addEventListener('click', async () => {
      pin.disabled = true;
      try {
        await setMessageSticky(message.id, !message.is_sticky);
        allMessages = allMessages!.map((m) => (m.id === message.id ? { ...m, is_sticky: !m.is_sticky } : m));
        refreshMessages();
        showToast(message.is_sticky ? 'Nachricht gelöst.' : 'Nachricht angeheftet.');
      } catch (err) {
        showToast(`Ändern fehlgeschlagen: ${(err as Error).message}`);
        pin.disabled = false;
      }
    });
    const del = h('button', { type: 'button', class: 'btn danger small' }, 'Löschen');
    del.setAttribute('aria-label', `Nachricht von ${message.author_name} löschen`);
    del.addEventListener('click', async () => {
      if (!(await confirmDialog('Nachricht löschen?', `Nachricht von «${message.author_name}» wirklich löschen?`, 'Ja, löschen'))) return;
      try {
        await deleteMessage(message.id);
        allMessages = allMessages!.filter((m) => m.id !== message.id);
        refreshMessages();
        showToast('Nachricht gelöscht.');
      } catch (err) {
        showToast(`Löschen fehlgeschlagen: ${(err as Error).message}`);
      }
    });
    return h(
      'tr',
      { class: message.is_admin ? 'message-row admin' : 'message-row' },
      h('td', {}, findVillage(message.village_slug)?.name ?? message.village_slug),
      h(
        'td',
        {},
        message.author_name,
        message.is_admin ? h('span', { class: 'badge admin' }, 'Admin') : null,
        message.is_sticky ? h('span', { class: 'badge sticky' }, '📌') : null,
      ),
      // Nur als Text eingefügt, nie als HTML
      h('td', { class: 'message-body' }, message.body),
      h('td', {}, formatDateTime(message.created_at)),
      h('td', {}, h('div', { class: 'actions' }, pin, del)),
    );
  }

  function row(entry: Entry): HTMLElement {
    const show = h('button', { type: 'button', class: 'link-btn' }, entry.address_label);
    show.addEventListener('click', () => {
      mapEl.scrollIntoView({ block: 'nearest' });
      map.focus(entry);
      map.openPopup(entry.id);
    });
    const edit = h('button', { type: 'button', class: 'btn secondary small' }, 'Bearbeiten');
    edit.setAttribute('aria-label', `${entry.address_label} bearbeiten`);
    edit.addEventListener('click', () =>
      openEditDialog(entry, (updated) => {
        all = all.map((e) => (e.id === updated.id ? updated : e));
        refresh(false);
        showToast('Eintrag aktualisiert.');
      }),
    );
    const del = h('button', { type: 'button', class: 'btn danger small' }, 'Löschen');
    del.setAttribute('aria-label', `${entry.address_label} löschen`);
    del.addEventListener('click', async () => {
      if (!(await confirmDialog('Eintrag löschen?', `«${entry.address_label}» wirklich löschen?`, 'Ja, löschen'))) return;
      try {
        await deleteEntryAsAdmin(entry.id);
        all = all.filter((e) => e.id !== entry.id);
        refresh(false);
        showToast('Eintrag gelöscht.');
      } catch (err) {
        showToast(`Löschen fehlgeschlagen: ${(err as Error).message}`);
      }
    });
    return h(
      'tr',
      {},
      h('td', {}, findVillage(entry.village_slug)?.name ?? entry.village_slug),
      h('td', {}, show),
      h('td', {}, entry.note ?? ''),
      h('td', {}, formatDateTime(entry.created_at)),
      h('td', {}, h('div', { class: 'actions' }, edit, del)),
    );
  }

  refresh(true);
}

function openEditDialog(entry: Entry, onSaved: (updated: Entry) => void): void {
  // Ganze Schweiz, damit auch Adressen eines anderen Orts gesucht werden können
  const autocomplete = createAddressAutocomplete(createGeocoder(), SWITZERLAND);
  // Vorbelegt mit der bestehenden Adresse: ohne neue Auswahl bleiben die Koordinaten unverändert
  autocomplete.setSelected({ label: entry.address_label, lat: entry.lat, lng: entry.lng });
  autocomplete.input.setAttribute('autofocus', '');

  const slugOptions = [...new Set([...villages.map((v) => v.slug), entry.village_slug])];
  const villageSelect = h(
    'select',
    { id: 'edit-village' },
    ...slugOptions.map((s) => h('option', { value: s }, findVillage(s)?.name ?? s)),
  );
  villageSelect.value = entry.village_slug;

  const note = h('textarea', { id: 'edit-note', maxlength: 140, rows: 2 });
  note.value = entry.note ?? '';
  const error = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn' }, 'Speichern');
  const form = h(
    'form',
    { novalidate: true },
    h(
      'div',
      { class: 'field' },
      h('label', { for: autocomplete.input.id }, 'Adresse (zum Neu-Geocodieren neu suchen)'),
      autocomplete.el,
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'edit-village' }, 'Ort'),
      villageSelect,
      h('p', { class: 'field-hint' }, 'Beim Umhängen die Adresse oben bei Bedarf neu suchen, damit die Position stimmt.'),
    ),
    h('div', { class: 'field' }, h('label', { for: 'edit-note' }, 'Hinweis'), note),
    error,
    submit,
  );
  const dialog = openDialog('Eintrag bearbeiten', form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selected = autocomplete.getSelected();
    if (!selected) {
      error.textContent = 'Bitte eine Adresse aus der Vorschlagsliste wählen.';
      autocomplete.input.focus();
      return;
    }
    submit.disabled = true;
    const update = { village_slug: villageSelect.value, address_label: selected.label, lat: selected.lat, lng: selected.lng, note: note.value.trim() || null };
    try {
      await updateEntry(entry.id, update);
      dialog.close();
      onSaved({ ...entry, ...update });
    } catch (err) {
      error.textContent = `Speichern fehlgeschlagen: ${(err as Error).message}`;
      submit.disabled = false;
    }
  });
}
