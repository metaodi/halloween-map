import { contact } from '../config/contact';
import { h } from '../lib/dom';

/** Kontaktzeile (Name, E-Mail, Instagram). */
export function contactInfo(): HTMLElement {
  return h(
    'p',
    { class: 'contact' },
    `${contact.name} · `,
    h('a', { href: `mailto:${contact.email}` }, contact.email),
    ' · Insta ',
    h('a', { href: contact.instagramUrl, target: '_blank', rel: 'noopener noreferrer' }, contact.instagram),
  );
}
