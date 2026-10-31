const ADJECTIVES = [
  'Lazy', 'Spooky', 'Sleepy', 'Grumpy', 'Happy', 'Sneaky', 'Fuzzy', 'Brave', 'Silly', 'Jolly',
  'Creepy', 'Witty', 'Clever', 'Mighty', 'Shy', 'Wild', 'Gentle', 'Curious', 'Hungry', 'Sparkly',
];
const ANIMALS = [
  'Ocelot', 'Bat', 'Owl', 'Cat', 'Spider', 'Raven', 'Fox', 'Hedgehog', 'Badger', 'Toad',
  'Wolf', 'Lynx', 'Otter', 'Squirrel', 'Beaver', 'Panda', 'Gecko', 'Moose', 'Lemur', 'Llama',
];

const STORAGE_KEY = 'halloween-map:nickname';

function pick<T>(list: T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}

/** Zufälliger Name wie «LazyOcelot». */
export function randomNickname(random: () => number = Math.random): string {
  return pick(ADJECTIVES, random) + pick(ANIMALS, random);
}

/** Zuletzt verwendeter Name aus diesem Browser, sonst ein neuer Zufallsname. */
export function loadNickname(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage nicht verfügbar (z. B. privater Modus)
  }
  return randomNickname();
}

export function saveNickname(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignorieren
  }
}
