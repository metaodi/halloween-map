import { describe, expect, it } from 'vitest';
import { sanitizePlainText } from './sanitize';
import { randomNickname } from './nickname';

describe('sanitizePlainText', () => {
  it('entfernt HTML-Tags und spitze Klammern', () => {
    expect(sanitizePlainText('Hallo <b>Welt</b><script>alert(1)</script>')).toBe('Hallo Weltalert(1)');
    expect(sanitizePlainText('<img src=x onerror=alert(1)>Hi')).toBe('Hi');
    expect(sanitizePlainText('a < b > c')).toBe('a b c');
  });

  it('entfernt BBCode, lässt normale eckige Klammern stehen', () => {
    expect(sanitizePlainText('[b]fett[/b] [url=http://x.y]Link[/url] [sic]')).toBe('fett Link [sic]');
  });

  it('entfernt Steuer- und unsichtbare Zeichen', () => {
    expect(sanitizePlainText('a\u0007b​c‮d﻿')).toBe('abcd');
  });

  it('normalisiert Leerraum und Zeilenumbrüche', () => {
    expect(sanitizePlainText('  Hallo   du \r\n\r\n\r\n\n  da  ')).toBe('Hallo du\n\nda');
    expect(sanitizePlainText('Zeile 1\nZeile 2', false)).toBe('Zeile 1 Zeile 2');
  });

  it('lässt Markdown als normalen Text stehen', () => {
    expect(sanitizePlainText('**nicht fett** und _so_')).toBe('**nicht fett** und _so_');
  });
});

describe('randomNickname', () => {
  it('kombiniert Adjektiv und Tier', () => {
    expect(randomNickname(() => 0)).toBe('LazyOcelot');
    expect(randomNickname()).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
  });
});
