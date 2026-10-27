import type { Village } from '../config/villages';
import { h } from '../lib/dom';

/** Gut sichtbarer Hinweis einer Gemeinde (z. B. auf eine bestehende Facebook-Gruppe), oder null. */
export function villageNotice(village: Village): HTMLElement | null {
  const notice = village.notice;
  if (!notice) return null;
  return h(
    'p',
    { class: 'village-notice' },
    `ℹ️ ${notice.text} `,
    notice.link ? h('a', { href: notice.link.href, target: '_blank', rel: 'noopener' }, notice.link.label) : null,
  );
}
