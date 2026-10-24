const STORAGE_KEY = 'halloweenmap:tokens';

/** Zufälliger Löschtoken (wird nur als SHA-256-Hash in der DB gespeichert). */
export function generateToken(): string {
  return crypto.randomUUID();
}

/**
 * SHA-256 als Hex-String – gleiche Berechnung wie serverseitig in den RPCs
 * (`encode(digest(token, 'sha256'), 'hex')`). Nützlich, um einen Token mit
 * `entries.delete_token_hash` abzugleichen.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Löschtokens der eigenen Einträge (entryId → token), nur im Browser gespeichert. */
export function loadTokens(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveTokens(tokens: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // localStorage nicht verfügbar (z. B. privater Modus): der Löschlink funktioniert trotzdem
  }
}

export function rememberToken(entryId: string, token: string): void {
  saveTokens({ ...loadTokens(), [entryId]: token });
}

export function forgetToken(entryId: string): void {
  const { [entryId]: _removed, ...rest } = loadTokens();
  saveTokens(rest);
}

export function tokenFor(entryId: string): string | undefined {
  return loadTokens()[entryId];
}
