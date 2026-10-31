/**
 * Funktionen ein- und ausschalten. Pro Ort kann der Wert in `villages.ts`
 * überschrieben werden (z. B. `messages: false`).
 */
export const features = {
  /** Nachrichten-Pinnwand pro Ort (Button «Nachrichten» auf der Karte) */
  messages: true,
  /** Wie oft (Sekunden) auf neue Nachrichten geprüft wird, solange die Seite sichtbar ist */
  messagesPollSeconds: 60,
};
