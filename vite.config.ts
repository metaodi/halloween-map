import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages liefert Projektseiten unter /<repo>/ aus (setzt der Workflow über VITE_BASE).
  base: (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VITE_BASE ?? '/',
  test: {
    environment: 'node',
  },
});
