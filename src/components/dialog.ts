import { h } from '../lib/dom';

let counter = 0;

export interface DialogHandle {
  el: HTMLDialogElement;
  body: HTMLElement;
  close(): void;
}

/**
 * Modaler Dialog auf Basis von <dialog>: Fokus-Falle, Escape und inerter Hintergrund
 * kommen vom Browser. Der Fokus geht beim Öffnen auf den ersten Inhalt mit [autofocus]
 * (sonst auf die Überschrift) und beim Schliessen zurück zum auslösenden Element.
 */
export function openDialog(title: string, content: Node): DialogHandle {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const titleId = `dialog-title-${++counter}`;

  const heading = h('h2', { id: titleId, tabindex: '-1' }, title);
  const closeBtn = h('button', { type: 'button', class: 'dialog-close', 'aria-label': 'Schliessen' }, '×');
  const body = h('div', { class: 'dialog-body' }, content);
  const el = h(
    'dialog',
    { class: 'modal', 'aria-labelledby': titleId },
    h('div', { class: 'dialog-head' }, heading, closeBtn),
    body,
  );

  const close = () => el.close();
  closeBtn.addEventListener('click', close);
  // Klick auf den Hintergrund (::backdrop) schliesst den Dialog
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  el.addEventListener('close', () => {
    el.remove();
    previouslyFocused?.focus?.();
  });

  document.body.append(el);
  el.showModal();
  if (!el.contains(document.activeElement) || document.activeElement === closeBtn) {
    (el.querySelector<HTMLElement>('[autofocus]') ?? heading).focus();
  }
  return { el, body, close };
}
