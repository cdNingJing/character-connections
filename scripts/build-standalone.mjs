import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve('dist');
let html = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const cssMatch = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if (!scriptMatch || !cssMatch) throw new Error('构建产物缺少脚本或样式');
const javascript = await readFile(resolve(outputDirectory, scriptMatch[1]), 'utf8');
const css = await readFile(resolve(outputDirectory, cssMatch[1]), 'utf8');
html = html.replace(
  scriptMatch[0],
  () => `<script type="module">${javascript.replace(/<\/script/gi, '<\\/script')}</script>`,
);
html = html.replace(cssMatch[0], () => `<style>${css}</style>`);
await writeFile(resolve(outputDirectory, 'standalone.html'), html);
console.log('已生成 dist/standalone.html，可直接用浏览器打开');
