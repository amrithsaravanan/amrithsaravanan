import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Injects the list of built files into dist/sw.js so the whole app is cached
// on first visit and works fully offline.
function precacheManifest(): Plugin {
  let outDir = 'dist';
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
    );
  return {
    name: 'examlab-precache',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;
      const files = walk(outDir)
        .filter((f) => !f.endsWith('sw.js') && !f.endsWith('.map'))
        .map((f) => './' + path.relative(outDir, f).split(path.sep).join('/'));
      let src = fs.readFileSync(swPath, 'utf8');
      src = src.replace('"__PRECACHE__"', JSON.stringify(['./', ...files]));
      src = src.replace('"__BUILD_ID__"', JSON.stringify(String(Date.now())));
      fs.writeFileSync(swPath, src);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), precacheManifest()],
});
