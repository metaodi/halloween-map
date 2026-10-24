import { villages } from '../config/villages';
import { h } from '../lib/dom';

export function renderVillageSelectPage(root: HTMLElement): void {
  root.replaceChildren(
    h(
      'main',
      { class: 'page narrow' },
      h('h1', {}, '🎃 HalloweenMap'),
      h('p', {}, 'Wo ist an Halloween Trick-or-Treat erwünscht? Wähle deinen Ort:'),
      h(
        'ul',
        { class: 'village-list' },
        ...villages.map((v) =>
          h('li', {}, h('a', { class: 'btn', href: `${import.meta.env.BASE_URL}?ort=${encodeURIComponent(v.slug)}` }, v.name)),
        ),
      ),
    ),
  );
}
