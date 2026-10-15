import { readdir, readFile, writeFile } from 'node:fs/promises';
const directory = 'dist/lib/types';
for (const file of await readdir(directory)) {
  if (!file.endsWith('.d.ts')) continue;
  const path = `${directory}/${file}`;
  const source = await readFile(path, 'utf8');
  await writeFile(
    path,
    source.replace(
      /(from ['"])(\.\.?\/[^'"]+)(['"])/g,
      (_match, prefix, path, suffix) =>
        `${prefix}${/\.[a-z]+$/.test(path) ? path : `${path}.js`}${suffix}`,
    ),
  );
}
await writeFile(`${directory}/graph.css.d.ts`, 'export {};\n');
