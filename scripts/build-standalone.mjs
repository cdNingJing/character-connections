import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
const result = await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    write: false,
    lib: { entry: 'src/main.ts', formats: ['iife'], name: 'CharacterConnectionsWorkbench' },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((result) => result.output);
const javascript = outputs
  .filter((output) => output.type === 'chunk')
  .map((output) => output.code)
  .join('\n');
const css = outputs
  .filter((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
  .map((output) => String(output.source))
  .join('\n');
let html = await readFile('workbench.html', 'utf8');
html = html
  .replace(
    /<script\b[^>]*src="[^"]+"[^>]*><\/script>/,
    () => `<script>${javascript.replace(/<\/script/gi, '<\\/script')}</script>`,
  )
  .replace('</head>', () => `<style>${css}</style></head>`);
await writeFile('dist/standalone.html', html);
console.log('已生成独立工作台 dist/standalone.html');
