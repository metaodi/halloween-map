import { h } from '../lib/dom';
import { openDialog } from './dialog';

/** Bestätigungsdialog; löst mit `true` auf, wenn bestätigt wurde. */
export function confirmDialog(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const confirm = h('button', { type: 'button', class: 'btn danger' }, confirmLabel);
    const cancel = h('button', { type: 'button', class: 'btn secondary', autofocus: true }, 'Abbrechen');
    let result = false;
    const dialog = openDialog(title, h('div', {}, h('p', {}, message), h('div', { class: 'actions' }, confirm, cancel)));
    confirm.addEventListener('click', () => {
      result = true;
      dialog.close();
    });
    cancel.addEventListener('click', () => dialog.close());
    dialog.el.addEventListener('close', () => resolve(result));
  });
}
