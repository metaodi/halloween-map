import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetToken, generateToken, loadTokens, messageTokens, rememberToken, sha256Hex, tokenFor } from './token';

describe('sha256Hex', () => {
  it('entspricht den bekannten SHA-256-Testvektoren (wie digest(..., \'sha256\') in Postgres)', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('liefert 64 Hex-Zeichen und ist deterministisch', async () => {
    const token = generateToken();
    const hash = await sha256Hex(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex(token)).toBe(hash);
  });
});

describe('generateToken', () => {
  it('erzeugt eindeutige UUIDs (passen in die 16–100 Zeichen der RPC)', () => {
    const a = generateToken();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(generateToken()).not.toBe(a);
  });
});

describe('Token-Speicher', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });

  it('merkt und vergisst Tokens pro Eintrag', () => {
    rememberToken('e1', 't1');
    rememberToken('e2', 't2');
    expect(tokenFor('e1')).toBe('t1');
    forgetToken('e1');
    expect(loadTokens()).toEqual({ e2: 't2' });
  });

  it('speichert Nachrichten-Tokens getrennt von den Eintrags-Tokens', () => {
    rememberToken('e1', 't1');
    messageTokens.remember('m1', 'mt1');
    expect(messageTokens.tokenFor('m1')).toBe('mt1');
    expect(tokenFor('m1')).toBeUndefined();
    messageTokens.forget('m1');
    expect(messageTokens.load()).toEqual({});
    expect(loadTokens()).toEqual({ e1: 't1' });
  });

  it('übersteht kaputte Daten und fehlendes localStorage', () => {
    localStorage.setItem('halloweenmap:tokens', '{kaputt');
    expect(loadTokens()).toEqual({});
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blockiert');
      },
      setItem: () => {
        throw new Error('blockiert');
      },
    });
    expect(() => rememberToken('e', 't')).not.toThrow();
    expect(tokenFor('e')).toBeUndefined();
  });
});
