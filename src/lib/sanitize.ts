/**
 * Bereinigt Benutzertext zu Klartext: entfernt HTML-Tags, BBCode, Steuer- und
 * unsichtbare Zeichen (Zero-Width, Bidi) und überflüssigen Leerraum. Markdown wird
 * nicht interpretiert, sondern bleibt als normaler Text stehen.
 * Entspricht public.sanitize_plain_text in der DB (dort verbindlich). Angezeigt wird
 * ohnehin nur per textContent, nie per innerHTML.
 */
const INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;
const HTML_TAG = /<\/?[a-zA-Z!][^>]*>/g;
const BBCODE = /\[\/?(b|i|u|s|url|img|quote|code|color|size|font|list|center|left|right|spoiler|email|\*)(=[^\]]*)?\]/gi;

export function sanitizePlainText(input: string, multiline = true): string {
  let s = input.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  if (!multiline) s = s.replace(/\n/g, ' ');
  s = s.replace(INVISIBLE, '');
  s = s.replace(HTML_TAG, '').replace(/[<>]/g, '');
  s = s.replace(BBCODE, '');
  s = s.replace(/ {2,}/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.replace(/^[ \n]+|[ \n]+$/g, '');
}
