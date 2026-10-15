import { mkdir, writeFile } from 'node:fs/promises';
import { createJourneyDocument } from '../src/data/journey.ts';

await mkdir(new URL('../examples/', import.meta.url), { recursive: true });
for (let stage = 0; stage < 4; stage++) {
  const document = createJourneyDocument(stage);
  const name = `journey-stage-${stage + 1}.json`;
  await writeFile(
    new URL(`../examples/${name}`, import.meta.url),
    JSON.stringify(document, null, 2) + '\n',
  );
  console.log(`${name}: ${document.characters.length} 人物 / ${document.relations.length} 关系`);
}
