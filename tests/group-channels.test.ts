import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findChannelPath,
  getAllCrossGroupChannelRoutes,
  shouldDisplayCrossGroupRelation,
  doesSegmentCrossRectangle,
} from '../src/lib/group-channels.ts';
import { getAllGroupRegions } from '../src/lib/group-regions.ts';
import {
  getAllGroupPositions,
  GROUP_COLORS,
  parseGraphDocument,
  parseGraphOptions,
} from '../src/lib/model.ts';
import { createJourneyDocument } from '../src/data/journey.ts';

test('orthogonal channel goes around an intervening group', () => {
  const obstacle = { x: 40, y: -20, width: 40, height: 40 };
  const route = findChannelPath({ x: 0, y: 0 }, { x: 120, y: 0 }, [obstacle])!;
  assert.ok(route.length > 2);
  for (let i = 1; i < route.length; i++)
    assert.equal(doesSegmentCrossRectangle(route[i - 1], route[i], obstacle), false);
});
test('all 30 cross-group relations use channels without crossing unrelated groups or cards', () => {
  const document = createJourneyDocument(3);
  const positions = getAllGroupPositions({
    ...document,
    characters: document.characters.map((p) => ({ ...p, position: undefined })),
  });
  const nodes = document.characters.map((p) => ({
    id: p.id,
    group: p.group,
    ...positions.get(p.id)!,
    width: 137,
    height: 96,
  }));
  const regions = getAllGroupRegions(document, nodes, 42, GROUP_COLORS);
  const routes = getAllCrossGroupChannelRoutes(document, nodes, regions);
  assert.equal(routes.size, 30);
  for (const [id, route] of routes) {
    const relation = document.relations.find((r) => r.id === id)!;
    const a = nodes.find((n) => n.id === relation.source)!,
      b = nodes.find((n) => n.id === relation.target)!;
    for (let i = 1; i < route.points.length; i++) {
      const start = route.points[i - 1],
        end = route.points[i];
      assert.ok(start.x === end.x || start.y === end.y);
      for (const region of regions.filter((r) => r.name !== a.group && r.name !== b.group))
        assert.equal(
          doesSegmentCrossRectangle(start, end, region),
          false,
          `${id} crosses ${region.name}`,
        );
      for (const node of nodes.filter((n) => n.id !== a.id && n.id !== b.id))
        assert.equal(
          doesSegmentCrossRectangle(start, end, {
            x: node.x - node.width / 2,
            y: node.y - node.height / 2,
            width: node.width,
            height: node.height,
          }),
          false,
          `${id} crosses ${node.id}`,
        );
    }
  }
  assert.deepEqual(
    getAllCrossGroupChannelRoutes(
      { ...document, relations: [...document.relations].reverse() },
      [...nodes].reverse(),
      [...regions].reverse(),
    ),
    routes,
  );
});
test('only selected character cross-group relations expand; all switch and clear selection work', () => {
  const relation = { id: 'r', source: 'a', target: 'b' };
  assert.equal(shouldDisplayCrossGroupRelation('selected', relation, null), false);
  assert.equal(
    shouldDisplayCrossGroupRelation('selected', relation, { kind: 'character', id: 'a' }),
    true,
  );
  assert.equal(
    shouldDisplayCrossGroupRelation('selected', relation, { kind: 'character', id: 'c' }),
    false,
  );
  assert.equal(
    shouldDisplayCrossGroupRelation('selected', relation, { kind: 'relation', id: 'r' }),
    true,
  );
  assert.equal(shouldDisplayCrossGroupRelation('all', relation, null), true);
});
test('channel options survive export and reject invalid modes', () => {
  const document = createJourneyDocument(1);
  document.appearance = parseGraphOptions({
    crossGroupRouting: 'channels',
    crossGroupVisibility: 'selected',
  });
  assert.deepEqual(
    parseGraphDocument(JSON.parse(JSON.stringify(document))).appearance,
    document.appearance,
  );
  assert.throws(() => parseGraphOptions({ crossGroupVisibility: 'hidden' }));
});
