import { h } from '../lib/dom';
import type { BBox, GeocodeResult, GeocoderProvider } from '../lib/geocoding';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;
let counter = 0;

export interface AddressAutocomplete {
  el: HTMLElement;
  input: HTMLInputElement;
  /** Gewählter Treffer; `null`, sobald der Text nach der Auswahl verändert wurde. */
  getSelected(): GeocodeResult | null;
  setSelected(result: GeocodeResult): void;
}

/** Combobox (ARIA 1.2 «list autocomplete»): Pfeiltasten, Enter, Escape sowie Tippen/Tap auf Treffer. */
export function createAddressAutocomplete(geocoder: GeocoderProvider, bbox: BBox): AddressAutocomplete {
  const id = `addr-${++counter}`;
  const listId = `${id}-list`;
  const statusId = `${id}-status`;

  const input = h('input', {
    id,
    type: 'text',
    role: 'combobox',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    required: true,
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
    'aria-describedby': statusId,
    placeholder: 'Strasse und Nr., z. B. Seestrasse 12',
  });
  const list = h('ul', { id: listId, role: 'listbox', class: 'suggestions', 'aria-label': 'Adressvorschläge', hidden: true });
  const status = h('p', { id: statusId, class: 'field-hint', role: 'status' }, 'Bitte einen Vorschlag aus der Liste wählen.');
  const el = h('div', { class: 'autocomplete' }, input, list, status);

  let selected: GeocodeResult | null = null;
  let results: GeocodeResult[] = [];
  let active = -1;
  let timer: number | undefined;
  let controller: AbortController | undefined;

  function setActive(index: number) {
    active = index;
    list.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) {
      input.setAttribute('aria-activedescendant', `${id}-opt-${index}`);
      list.children[index]?.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function closeList() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  }

  function choose(result: GeocodeResult) {
    selected = result;
    input.value = result.label;
    input.setCustomValidity('');
    closeList();
    status.textContent = 'Adresse ausgewählt.';
  }

  function render() {
    list.replaceChildren(
      ...results.map((r, i) => {
        const li = h('li', { id: `${id}-opt-${i}`, role: 'option', 'aria-selected': 'false' }, r.label);
        // pointerdown statt click: verhindert, dass der Input vorher den Fokus verliert und die Liste schliesst
        li.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          choose(r);
        });
        return li;
      }),
    );
    list.hidden = results.length === 0;
    input.setAttribute('aria-expanded', String(results.length > 0));
    setActive(-1);
  }

  async function runSearch(query: string) {
    controller?.abort();
    controller = new AbortController();
    status.textContent = 'Suche …';
    try {
      results = await geocoder.search(query, bbox, controller.signal);
      render();
      status.textContent =
        results.length > 0
          ? `${results.length} Vorschläge. Mit den Pfeiltasten wählen.`
          : 'Keine passende Adresse in diesem Gebiet gefunden.';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      results = [];
      render();
      status.textContent = 'Die Adresssuche ist gerade nicht erreichbar. Bitte später erneut versuchen.';
    }
  }

  input.addEventListener('input', () => {
    selected = null;
    window.clearTimeout(timer);
    const query = input.value.trim();
    if (query.length < MIN_CHARS) {
      controller?.abort();
      results = [];
      render();
      status.textContent = 'Bitte einen Vorschlag aus der Liste wählen.';
      return;
    }
    timer = window.setTimeout(() => void runSearch(query), DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      if (list.hidden) render();
      setActive((active + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      setActive(active <= 0 ? results.length - 1 : active - 1);
    } else if (e.key === 'Enter' && !list.hidden) {
      e.preventDefault(); // Formular nicht absenden, solange die Liste offen ist
      const pick = results[active] ?? (results.length === 1 ? results[0] : undefined);
      if (pick) choose(pick);
    } else if (e.key === 'Escape' && !list.hidden) {
      e.stopPropagation(); // schliesst nur die Liste, nicht den Dialog
      e.preventDefault();
      closeList();
    }
  });

  input.addEventListener('blur', () => closeList());

  return {
    el,
    input,
    getSelected: () => selected,
    setSelected: (r) => choose(r),
  };
}
