import type { Village } from '../config/villages';
import { h } from '../lib/dom';
import { createGeocoder } from '../lib/geocoding';
import { createEntry, SupabaseRpcError } from '../lib/supabase/entries';
import { generateToken, rememberToken } from '../lib/token';
import { createAddressAutocomplete } from './addressAutocomplete';
import { openDialog } from './dialog';

const NOTE_MAX = 140;
const RATE_LIMIT_CODE = '54000';
const INVALID_PARAMETER_CODE = '22023';

export interface CreatedEntry {
  id: string;
  address_label: string;
  lat: number;
  lng: number;
  note: string | null;
  token: string;
}

export function deleteLinkFor(village: Village, token: string): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set('ort', village.slug);
  url.searchParams.set('loeschen', token);
  return url.toString();
}

/** Öffnet das Formular «Meine Adresse eintragen». `onCreated` wird nach dem Speichern aufgerufen. */
export function openEntryForm(village: Village, onCreated: (entry: CreatedEntry) => void): void {
  const geocoder = createGeocoder();
  const autocomplete = createAddressAutocomplete(geocoder, village.bbox);
  autocomplete.input.setAttribute('autofocus', '');

  const note = h('textarea', { id: 'entry-note', maxlength: NOTE_MAX, rows: 2, placeholder: 'z. B. ab 17 Uhr, bitte klingeln' });
  const counter = h('span', { class: 'field-hint', 'aria-hidden': 'true' }, `0/${NOTE_MAX}`);
  note.addEventListener('input', () => (counter.textContent = `${note.value.length}/${NOTE_MAX}`));

  const consent = h('input', { id: 'entry-consent', type: 'checkbox', required: true });
  // Honeypot: für Menschen unsichtbar und nicht erreichbar, Bots füllen es aus
  const honeypot = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' });
  const honeypotWrap = h('div', { class: 'hp', 'aria-hidden': 'true' }, h('label', {}, 'Website'), honeypot);

  const error = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn' }, 'Eintragen');

  const form = h(
    'form',
    { novalidate: true },
    h('div', { class: 'field' }, h('label', { for: autocomplete.input.id }, 'Adresse'), autocomplete.el),
    h('div', { class: 'field' }, h('label', { for: 'entry-note' }, 'Hinweis (optional)'), note, counter),
    h(
      'div',
      { class: 'field checkbox' },
      consent,
      h('label', { for: 'entry-consent' }, 'Ich bin einverstanden, dass meine Adresse öffentlich auf der Karte angezeigt und bis zu meinem Widerruf gespeichert wird.'),
    ),
    honeypotWrap,
    h(
      'p',
      { class: 'privacy' },
      'Gespeichert werden nur Adresse und Hinweis, kein Name. Dein Eintrag bleibt gespeichert, bis du ihn widerrufst. Du kannst ihn jederzeit mit deinem persönlichen Löschlink entfernen.',
    ),
    error,
    submit,
  );

  const dialog = openDialog('Meine Adresse eintragen', form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    const selected = autocomplete.getSelected();
    if (!selected) {
      error.textContent = 'Bitte wähle deine Adresse aus der Vorschlagsliste aus.';
      autocomplete.input.focus();
      return;
    }
    if (!consent.checked) {
      error.textContent = 'Bitte bestätige das Einverständnis zur öffentlichen Anzeige.';
      consent.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Speichern …';
    const token = generateToken();
    const noteValue = note.value.trim() || null;

    // Honeypot gefüllt: Bot. Erfolg vortäuschen, aber nichts speichern.
    const id = honeypot.value
      ? crypto.randomUUID()
      : await createEntry({
          village_slug: village.slug,
          address_label: selected.label,
          lat: selected.lat,
          lng: selected.lng,
          note: noteValue,
          token,
        }).catch((err: unknown) => {
          console.error('Eintrag konnte nicht gespeichert werden', err);
          error.textContent =
            err instanceof SupabaseRpcError && err.code === RATE_LIMIT_CODE
              ? 'Gerade werden viele Einträge erfasst. Bitte versuche es in einer Minute erneut.'
              : err instanceof SupabaseRpcError && err.code === INVALID_PARAMETER_CODE
                ? 'Die Adresse wurde vom Server abgelehnt. Bitte wähle sie erneut aus der Vorschlagsliste.'
                : 'Der Eintrag konnte nicht gespeichert werden. Bitte versuche es später erneut.';
          return null;
        });

    submit.disabled = false;
    submit.textContent = 'Eintragen';
    if (!id) return;

    const created: CreatedEntry = {
      id,
      address_label: selected.label,
      lat: selected.lat,
      lng: selected.lng,
      note: noteValue,
      token,
    };
    if (!honeypot.value) {
      rememberToken(id, token);
      onCreated(created);
    }
    dialog.close();
    openConfirmation(village, created);
  });
}

function openConfirmation(village: Village, created: CreatedEntry): void {
  const link = deleteLinkFor(village, created.token);
  const linkInput = h('input', { id: 'delete-link', type: 'text', readonly: true, value: link });
  const feedback = h('p', { class: 'field-hint', role: 'status' });
  const copy = h('button', { type: 'button', class: 'btn secondary' }, 'Link kopieren');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      feedback.textContent = 'Link kopiert.';
    } catch {
      linkInput.select();
      feedback.textContent = 'Kopieren nicht möglich. Der Link ist markiert, bitte von Hand kopieren.';
    }
  });
  linkInput.addEventListener('focus', () => linkInput.select());

  const done = h('button', { type: 'button', class: 'btn', autofocus: true }, 'Fertig');
  const content = h(
    'div',
    {},
    h('p', {}, `Danke! 🎃 «${created.address_label}» ist jetzt auf der Karte.`),
    h(
      'p',
      {},
      'Mit diesem persönlichen Link kannst du deinen Eintrag jederzeit löschen. Bitte speichere ihn, wir können ihn später nicht mehr anzeigen. In diesem Browser findest du die Löschfunktion auch im Popup deines Markers.',
    ),
    h('div', { class: 'field' }, h('label', { for: 'delete-link' }, 'Dein Löschlink'), linkInput),
    h('div', { class: 'actions' }, copy, done),
    feedback,
  );
  const dialog = openDialog('Eintrag gespeichert', content);
  done.addEventListener('click', () => dialog.close());
}
