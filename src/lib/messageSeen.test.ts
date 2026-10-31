import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isNewer, lastSeenAt, markSeen } from './messageSeen';

describe('isNewer', () => {
  it('ohne Nachricht nie neu, ohne gesehenen Zeitpunkt immer neu', () => {
    expect(isNewer(null, undefined)).toBe(false);
    expect(isNewer('2026-10-31T17:00:00+00:00', undefined)).toBe(true);
  });

  it('vergleicht Zeitpunkte, nicht Strings', () => {
    expect(isNewer('2026-10-31T18:00:00+01:00', '2026-10-31T16:59:00Z')).toBe(true);
    expect(isNewer('2026-10-31T18:00:00+01:00', '2026-10-31T17:00:00Z')).toBe(false);
  });
});

describe('markSeen', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });

  it('merkt sich pro Ort und geht nie zurück', () => {
    markSeen('a', '2026-10-31T17:00:00Z');
    markSeen('a', '2026-10-30T17:00:00Z');
    markSeen('b', '2026-10-29T17:00:00Z');
    expect(lastSeenAt('a')).toBe('2026-10-31T17:00:00Z');
    expect(lastSeenAt('b')).toBe('2026-10-29T17:00:00Z');
  });
});
