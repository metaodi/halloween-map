import { villages, type Village } from '../config/villages';
import { contactInfo } from '../components/contactInfo';
import { showToast } from '../components/toast';
import { h } from '../lib/dom';

export function renderVillageSelectPage(root: HTMLElement): void {
  root.replaceChildren(
    h(
      'main',
      { class: 'page narrow' },
      h('h1', {}, '🎃 HalloweenKarte'),
      h('p', {}, 'Wo ist an Halloween Trick-or-Treat erwünscht? Wähle deinen Ort:'),
      h(
        'ul',
        { class: 'village-list' },
        ...villages.map((v) => h('li', {}, villageButton(v))),
      ),
      h('footer', { class: 'page-footer' }, h('p', {}, 'Fragen oder Wunsch nach einer neuen Gemeinde? Melde dich bei:'), contactInfo()),
    ),
  );
}

function villageButton(v: Village): HTMLElement {
  if (v.active) {
    return h('a', { class: 'btn', href: `${import.meta.env.BASE_URL}?ort=${encodeURIComponent(v.slug)}` }, v.name);
  }
  const btn = h('button', { type: 'button', class: 'btn inactive', 'aria-disabled': 'true' }, v.name);
  btn.addEventListener('click', () =>
    showToast(`${v.name} ist noch nicht freigeschaltet. Bitte kontaktiere mich (siehe Footer), damit ich die Gemeinde aufschalten kann.`),
  );
  return btn;
}
