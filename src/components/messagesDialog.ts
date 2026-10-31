import type { Village } from '../config/villages';
import { formatDateTime, h } from '../lib/dom';
import { loadNickname, saveNickname } from '../lib/nickname';
import { sanitizePlainText } from '../lib/sanitize';
import { currentUserId, isAdmin } from '../lib/supabase/admin';
import { supabase } from '../lib/supabase/client';
import { SupabaseRpcError } from '../lib/supabase/entries';
import { createMessage, deleteMessage, deleteOwnMessage, fetchMessages, setMessageSticky } from '../lib/supabase/messages';
import { generateToken, messageTokens } from '../lib/token';
import type { Message } from '../lib/types';
import { confirmDialog } from './confirmDialog';
import { openDialog } from './dialog';
import { showToast } from './toast';

const NAME_MAX = 30;
const BODY_MAX = 500;
const RATE_LIMIT_CODE = '54000';
const INVALID_PARAMETER_CODE = '22023';

let adminCheck: Promise<boolean> | null = null;

/** Ist im Browser ein Admin angemeldet? (Nur für die Anzeige; die DB prüft selbst.) */
function checkAdmin(): Promise<boolean> {
  if (!supabase) return Promise.resolve(false);
  adminCheck ??= (async () => {
    try {
      const userId = await currentUserId();
      return userId ? await isAdmin(userId) : false;
    } catch {
      return false;
    }
  })();
  return adminCheck;
}

/** Modal mit allen Nachrichten eines Orts (neueste oben, angeheftete zuoberst) und Formular unten. */
export function openMessagesDialog(village: Village): void {
  let messages: Message[] = [];
  let admin = false;

  const list = h('ul', { class: 'message-list', 'aria-label': 'Nachrichten' });
  const status = h('p', { class: 'field-hint', role: 'status' }, 'Nachrichten werden geladen …');

  const name = h('input', { id: 'message-name', type: 'text', maxlength: NAME_MAX, required: true, autocomplete: 'nickname' });
  name.value = loadNickname();
  const body = h('textarea', { id: 'message-body', maxlength: BODY_MAX, rows: 3, required: true });
  const counter = h('p', { class: 'field-hint', 'aria-live': 'polite' }, `0/${BODY_MAX}`);
  body.addEventListener('input', () => (counter.textContent = `${body.value.length}/${BODY_MAX}`));
  const asAdmin = h('input', { id: 'message-as-admin', type: 'checkbox', checked: true });
  const adminField = h(
    'div',
    { class: 'field checkbox', hidden: true },
    asAdmin,
    h('label', { for: 'message-as-admin' }, 'Als Admin-Nachricht senden (blau markiert)'),
  );
  const error = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn' }, 'Senden');

  const form = h(
    'form',
    { class: 'message-form', novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'message-name' }, 'Dein Name'), name),
    h('div', { class: 'field' }, h('label', { for: 'message-body' }, 'Nachricht'), body, counter),
    adminField,
    error,
    h('p', { class: 'privacy' }, 'Nachrichten sind öffentlich sichtbar. Nur Text, keine Formatierung oder Links. Deine eigenen Nachrichten kannst du in diesem Browser wieder löschen.'),
    submit,
  );

  openDialog(`Nachrichten ${village.name}`, h('div', { class: 'messages' }, status, list, form));

  function render() {
    status.textContent = messages.length === 0 ? 'Noch keine Nachrichten. Schreib die erste!' : '';
    status.hidden = messages.length > 0;
    list.replaceChildren(...messages.map(item));
  }

  function item(m: Message): HTMLElement {
    const classes = ['message', m.is_admin ? 'admin' : '', m.is_sticky ? 'sticky' : ''].filter(Boolean).join(' ');
    const actions: HTMLElement[] = [];
    const ownToken = messageTokens.tokenFor(m.id);
    if (ownToken && !admin) {
      const delOwn = h('button', { type: 'button', class: 'btn danger small' }, 'Meine Nachricht löschen');
      delOwn.addEventListener('click', async () => {
        if (!(await confirmDialog('Nachricht löschen?', 'Möchtest du deine Nachricht löschen? Das kann nicht rückgängig gemacht werden.', 'Ja, löschen'))) return;
        try {
          const deleted = await deleteOwnMessage(m.id, ownToken);
          messageTokens.forget(m.id);
          showToast(deleted ? 'Deine Nachricht wurde gelöscht.' : 'Diese Nachricht existiert nicht mehr.');
          await load();
        } catch {
          showToast('Die Nachricht konnte nicht gelöscht werden. Bitte versuche es erneut.');
        }
      });
      actions.push(delOwn);
    }
    if (admin) {
      const pin = h('button', { type: 'button', class: 'btn secondary small' }, m.is_sticky ? 'Lösen' : '📌 Anheften');
      pin.addEventListener('click', async () => {
        pin.disabled = true;
        try {
          await setMessageSticky(m.id, !m.is_sticky);
          await load();
        } catch (err) {
          showToast(`Ändern fehlgeschlagen: ${(err as Error).message}`);
          pin.disabled = false;
        }
      });
      const del = h('button', { type: 'button', class: 'btn danger small' }, 'Löschen');
      del.addEventListener('click', async () => {
        if (!(await confirmDialog('Nachricht löschen?', `Nachricht von «${m.author_name}» wirklich löschen?`, 'Ja, löschen'))) return;
        try {
          await deleteMessage(m.id);
          await load();
        } catch (err) {
          showToast(`Löschen fehlgeschlagen: ${(err as Error).message}`);
        }
      });
      actions.push(pin, del);
    }
    return h(
      'li',
      { class: ownToken ? `${classes} own` : classes },
      h(
        'div',
        { class: 'message-meta' },
        h('strong', {}, m.author_name),
        m.is_admin ? h('span', { class: 'badge admin' }, 'Admin') : null,
        m.is_sticky ? h('span', { class: 'badge sticky' }, '📌 Angeheftet') : null,
        ownToken ? h('span', { class: 'badge own' }, 'Von dir') : null,
        h('time', { datetime: m.created_at }, formatDateTime(m.created_at)),
      ),
      // Nur als Text eingefügt (h → textContent), nie als HTML
      h('p', { class: 'message-body' }, m.body),
      actions.length ? h('div', { class: 'actions' }, ...actions) : null,
    );
  }

  async function load() {
    try {
      messages = await fetchMessages(village.slug);
      render();
    } catch {
      status.hidden = false;
      status.textContent = 'Die Nachrichten konnten nicht geladen werden.';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    const cleanName = sanitizePlainText(name.value, false);
    const cleanBody = sanitizePlainText(body.value, true);
    if (!cleanName || cleanName.length > NAME_MAX) {
      error.textContent = `Bitte einen Namen mit höchstens ${NAME_MAX} Zeichen angeben.`;
      name.focus();
      return;
    }
    if (!cleanBody || cleanBody.length > BODY_MAX) {
      error.textContent = 'Bitte eine Nachricht eingeben.';
      body.focus();
      return;
    }
    if (!supabase) {
      error.textContent = 'Nachrichten sind in dieser Umgebung nicht verfügbar (Supabase nicht konfiguriert).';
      return;
    }
    submit.disabled = true;
    try {
      const token = generateToken();
      const id = await createMessage({
        village_slug: village.slug,
        author_name: cleanName,
        body: cleanBody,
        token,
        as_admin: admin && asAdmin.checked,
      });
      messageTokens.remember(id, token);
      saveNickname(cleanName);
      name.value = cleanName;
      body.value = '';
      counter.textContent = `0/${BODY_MAX}`;
      await load();
      list.scrollTop = 0;
      showToast('Deine Nachricht wurde gesendet.');
    } catch (err) {
      error.textContent =
        err instanceof SupabaseRpcError && err.code === RATE_LIMIT_CODE
          ? 'Gerade wurden viele Nachrichten geschrieben. Bitte versuche es in einer Minute erneut.'
          : err instanceof SupabaseRpcError && err.code === INVALID_PARAMETER_CODE
            ? err.message
            : 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.';
    } finally {
      submit.disabled = false;
    }
  });

  void (async () => {
    admin = await checkAdmin();
    adminField.hidden = !admin;
    await load();
  })();
}
