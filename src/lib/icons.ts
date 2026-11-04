/**
 * Einheitliche Inline-SVG-Icons (Stil: Linien, 24x24, runde Enden) – keine externe Icon-Bibliothek nötig.
 * Die Farbe folgt `currentColor`.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  /** Kreispfeil */
  reload: [
    ['path', { d: 'M20 12a8 8 0 1 1-2.35-5.65' }],
    ['path', { d: 'M20 4v4.5h-4.5' }],
  ],
  /** Fadenkreuz (wie Google Maps «Mein Standort») */
  locate: [
    ['circle', { cx: '12', cy: '12', r: '7' }],
    ['circle', { cx: '12', cy: '12', r: '2.5', fill: 'currentColor', stroke: 'none' }],
    ['path', { d: 'M12 2v3M12 19v3M2 12h3M19 12h3' }],
  ],
  /** Sprechblase */
  message: [['path', { d: 'M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.6A8 8 0 1 1 21 11.5z' }]],
  /** Info */
  info: [
    ['circle', { cx: '12', cy: '12', r: '9' }],
    ['path', { d: 'M12 11v5.5' }],
    ['circle', { cx: '12', cy: '7.6', r: '0.6', fill: 'currentColor' }],
  ],
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  for (const [tag, attrs] of ICONS[name]) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}
