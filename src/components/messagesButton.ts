import { features } from '../config/features';
import type { Village } from '../config/villages';
import { h } from '../lib/dom';
import { isNewer, lastSeenAt } from '../lib/messageSeen';
import { fetchLatestMessageAt } from '../lib/supabase/messages';
import { openMessagesDialog, type MessagesDialogHandle } from './messagesDialog';

/**
 * Button «Nachrichten» mit rotem Punkt, solange es ungelesene Nachrichten gibt.
 * Prüft regelmässig (nur bei sichtbarer Seite) auf neue Nachrichten; ist der Dialog
 * offen, wird stattdessen dessen Liste aktualisiert.
 */
export function createMessagesButton(village: Village): HTMLButtonElement {
  const dot = h('span', { class: 'unread-dot', hidden: true }, h('span', { class: 'sr-only' }, ' (neue Nachrichten)'));
  const btn = h(
    'button',
    { type: 'button', class: 'btn secondary messages-btn' },
    h('span', { 'aria-hidden': 'true' }, '💬'),
    h('span', { class: 'messages-btn-label' }, 'Nachrichten'),
    dot,
  );

  let dialog: MessagesDialogHandle | null = null;
  let polling = false;

  function setUnread(unread: boolean) {
    dot.hidden = !unread;
    btn.title = unread ? 'Neue Nachrichten' : 'Nachrichten';
  }

  async function check() {
    if (polling) return;
    polling = true;
    try {
      if (dialog) {
        await dialog.refresh();
      } else {
        const latest = await fetchLatestMessageAt(village.slug);
        setUnread(isNewer(latest, lastSeenAt(village.slug)));
      }
    } catch {
      // Netzwerkfehler: beim nächsten Intervall erneut versuchen
    } finally {
      polling = false;
    }
  }

  btn.addEventListener('click', () => {
    dialog = openMessagesDialog(village, { onSeen: () => setUnread(false) });
    dialog.el.addEventListener('close', () => (dialog = null));
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void check();
  }, features.messagesPollSeconds * 1000);
  // Zurück in den Tab/die App: sofort prüfen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  void check();

  return btn;
}
