const STORAGE_KEY = 'halloweenmap:messages-seen';

function load(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Zeitpunkt der neuesten Nachricht, die in diesem Browser gesehen wurde (pro Ort). */
export function lastSeenAt(villageSlug: string): string | undefined {
  return load()[villageSlug];
}

/** Merkt sich `createdAt` als gesehen (nur vorwärts, nie zurück). */
export function markSeen(villageSlug: string, createdAt: string | null | undefined): void {
  if (!createdAt || !isNewer(createdAt, lastSeenAt(villageSlug))) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...load(), [villageSlug]: createdAt }));
  } catch {
    // localStorage nicht verfügbar: der Hinweis erscheint dann bei jedem Besuch
  }
}

/** Ist `latest` neuer als `seen`? Ohne gesehenen Zeitpunkt gilt jede Nachricht als neu. */
export function isNewer(latest: string | null | undefined, seen: string | undefined): boolean {
  if (!latest) return false;
  if (!seen) return true;
  return Date.parse(latest) > Date.parse(seen);
}
