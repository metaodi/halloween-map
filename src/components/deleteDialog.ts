import { h } from '../lib/dom';
import { deleteEntry } from '../lib/supabase/entries';
import { forgetToken } from '../lib/token';
import { openDialog } from './dialog';

/** Bestätigungsdialog zum Löschen des eigenen Eintrags. */
export function openDeleteDialog(
  entry: { id: string; address_label: string },
  token: string,
  onDeleted: () => void,
): void {
  const error = h('p', { class: 'form-error', role: 'alert' });
  const confirm = h('button', { type: 'button', class: 'btn danger' }, 'Ja, löschen');
  const cancel = h('button', { type: 'button', class: 'btn secondary', autofocus: true }, 'Abbrechen');

  const dialog = openDialog(
    'Eintrag löschen?',
    h(
      'div',
      {},
      h('p', {}, `Möchtest du «${entry.address_label}» von der Karte entfernen? Das kann nicht rückgängig gemacht werden.`),
      error,
      h('div', { class: 'actions' }, confirm, cancel),
    ),
  );

  cancel.addEventListener('click', () => dialog.close());
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    error.textContent = '';
    try {
      // false = bereits gelöscht: aus Nutzersicht ist das Ziel erreicht, also lokal aufräumen
      await deleteEntry(entry.id, token);
      forgetToken(entry.id);
      dialog.close();
      onDeleted();
    } catch {
      error.textContent = 'Der Eintrag konnte nicht gelöscht werden. Bitte versuche es später erneut.';
      confirm.disabled = false;
    }
  });
}
