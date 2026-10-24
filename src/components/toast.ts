let timer: number | undefined;

/** Kurze Statusmeldung (Live-Region, wird von Screenreadern vorgelesen). */
export function showToast(message: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('visible');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el!.classList.remove('visible'), 6000);
}
