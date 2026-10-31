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

/** Speicher für Löschtokens (id → token), nur im Browser. */
function tokenStore(storageKey: string) {
  function load(): Record<string, string> {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }
  function save(tokens: Record<string, string>): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(tokens));
    } catch {
      // localStorage nicht verfügbar (z. B. privater Modus): der Löschlink funktioniert trotzdem
    }
  }
  return {
    load,
    remember: (id: string, token: string) => save({ ...load(), [id]: token }),
    forget: (id: string) => {
      const { [id]: _removed, ...rest } = load();
      save(rest);
    },
    tokenFor: (id: string): string | undefined => load()[id],
  };
}

/** Löschtokens der eigenen Einträge (entryId → token). */
const entryTokens = tokenStore(STORAGE_KEY);
export const loadTokens = entryTokens.load;
export const rememberToken = entryTokens.remember;
export const forgetToken = entryTokens.forget;
export const tokenFor = entryTokens.tokenFor;

/** Löschtokens der eigenen Nachrichten (messageId → token). */
export const messageTokens = tokenStore('halloweenmap:message-tokens');
