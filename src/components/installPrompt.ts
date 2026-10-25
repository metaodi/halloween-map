import { h } from '../lib/dom';

const DISMISSED_KEY = 'halloweenmap:install-dismissed';
const VISITS_KEY = 'halloweenmap:visits';
const SHOW_DELAY_MS = 5000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Speicher blockiert (z. B. privater Modus): Banner erscheint dann einfach erneut
  }
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad in Safari (andere iOS-Browser können die Installation ebenfalls, aber mit anderem Menü). */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/**
 * Hinweis zum Installieren der Karte als App. Chromium zeigt einen Installieren-Button
 * (`beforeinstallprompt`), iOS Safari eine Anleitung. Erscheint erst ab dem zweiten Besuch,
 * nur einmalig verwerfbar und nie in der bereits installierten App.
 */
export function setupInstallPrompt(): void {
  if (isStandalone() || readStorage(DISMISSED_KEY)) return;

  const visits = Number(readStorage(VISITS_KEY) ?? '0') + 1;
  writeStorage(VISITS_KEY, String(visits));
  if (visits < 2) return;

  let deferred: BeforeInstallPromptEvent | null = null;
  let banner: HTMLElement | null = null;
  let timerDone = false;

  function close(remember: boolean) {
    banner?.remove();
    banner = null;
    if (remember) writeStorage(DISMISSED_KEY, '1');
  }

  function show() {
    if (banner || !timerDone) return;
    const ios = isIosSafari();
    if (!deferred && !ios) return;

    const closeBtn = h('button', { type: 'button', class: 'install-close', 'aria-label': 'Hinweis schliessen' }, '×');
    closeBtn.addEventListener('click', () => close(true));

    let action: Node | null = null;
    if (deferred) {
      const installBtn = h('button', { type: 'button', class: 'btn small' }, 'Installieren');
      installBtn.addEventListener('click', async () => {
        const evt = deferred;
        if (!evt) return;
        deferred = null;
        await evt.prompt();
        await evt.userChoice;
        close(true);
      });
      action = installBtn;
    }
    const text = deferred ? 'Schneller Zugriff vom Home-Bildschirm.' : 'Tippe auf Teilen und dann «Zum Home-Bildschirm».';

    banner = h(
      'div',
      { class: 'install-banner', role: 'region', 'aria-label': 'App installieren' },
      h('span', { class: 'install-text' }, h('strong', {}, '🎃 Als App installieren'), h('br'), text),
      action,
      closeBtn,
    );
    document.body.append(banner);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    show();
  });
  window.addEventListener('appinstalled', () => close(true));
  window.setTimeout(() => {
    timerDone = true;
    show();
  }, SHOW_DELAY_MS);
}
