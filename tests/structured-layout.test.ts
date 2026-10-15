import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyDocument } from '../src/data/journey.ts';
import { getAllStructuredPositions, getAllRootedBranches } from '../src/lib/structured-layout.ts';
import { parseGraphDocument, parseGraphOptions } from '../src/lib/model.ts';

for (const layout of ['mindmap', 'tree', 'horizontal-tree', 'radial', 'grid'] as const) {
  test(`${layout}: deterministic, unique positions, core at origin`, () => {
    const document = createJourneyDocument(3);
    const positions = getAllStructuredPositions(document, layout);
    assert.equal(positions.size, 26);
    assert.deepEqual(positions.get('wukong'), { x: 0, y: 0 });
    assert.equal(new Set([...positions.values()].map((p) => `${p.x},${p.y}`)).size, 26);
    assert.deepEqual(
      getAllStructuredPositions(
        {
          ...document,
          characters: [...document.characters].reverse(),
          relations: [...document.relations].reverse(),
        },
        layout,
      ),
      positions,
    );
  });
}
test('tree uses existing relations only and handles disconnected characters', () => {
  const document = createJourneyDocument(3);
  document.characters.push({ id: 'isolated', name: '独立人物', group: '其他' });
  const { parents } = getAllRootedBranches(document);
  assert.equal(parents.get('isolated'), null);
  for (const [id, parent] of parents)
    if (parent)
      assert.ok(
        document.relations.some(
          (e) =>
            (e.source === id && e.target === parent) || (e.target === id && e.source === parent),
        ),
      );
  assert.equal(getAllStructuredPositions(document, 'mindmap').size, 27);
});
test('rich profiles round trip through JSON validation', () => {
  const document = parseGraphDocument(JSON.parse(JSON.stringify(createJourneyDocument(3))));
  assert.equal(document.characters.filter((p) => p.attributes && p.aliases?.length).length, 26);
  assert.equal(document.characters[0].attributes?.['兵器'], '如意金箍棒');
  assert.throws(() =>
    parseGraphDocument({
      ...document,
      characters: [{ ...document.characters[0], aliases: 'bad' }],
    }),
  );
  assert.throws(() =>
    parseGraphDocument({
      ...document,
      characters: [{ ...document.characters[0], attributes: { x: 42 } }],
    }),
  );
});
test('node appearance rejects unsupported shapes and invalid sizes', () => {
  assert.equal(parseGraphOptions({ nodeShape: 'diamond', nodeSize: 80 }).nodeShape, 'diamond');
  assert.throws(() => parseGraphOptions({ nodeShape: 'script' }));
  assert.throws(() => parseGraphOptions({ nodeSize: 1000 }));
});
