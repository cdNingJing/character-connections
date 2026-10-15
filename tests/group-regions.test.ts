import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAllGroupRegions } from '../src/lib/group-regions.ts';
import {
  parseGraphDocument,
  parseGraphOptions,
  getAllGroupPositions,
  GROUP_COLORS,
} from '../src/lib/model.ts';
import { createJourneyDocument } from '../src/data/journey.ts';

test('group metadata and background options round trip', () => {
  const data = createJourneyDocument(3);
  data.appearance = parseGraphOptions({
    showGroupBackground: true,
    groupOpacity: 0.12,
    groupPadding: 50,
    groupBorder: 'dashed',
    nodeContent: 'identity',
  });
  const result = parseGraphDocument(JSON.parse(JSON.stringify(data)));
  assert.equal(result.groups?.length, 4);
  assert.equal(result.groups?.[0].color, '#377e70');
  assert.deepEqual(result.appearance, data.appearance);
  assert.throws(() =>
    parseGraphDocument({ ...data, groups: [{ name: 'a', color: 'url(script)' }] }),
  );
  assert.throws(() => parseGraphDocument({ ...data, groups: [{ name: 'a' }, { name: 'a' }] }));
  assert.throws(() => parseGraphOptions({ groupOpacity: 1 }));
});
test('group background bounds contain all node bodies and reserve a title area', () => {
  const data = createJourneyDocument(3);
  const clean = {
    ...data,
    characters: data.characters.map((person) => ({ ...person, position: undefined })),
  };
  const positions = getAllGroupPositions(clean);
  const nodes = data.characters.map((person) => ({
    id: person.id,
    group: person.group,
    ...positions.get(person.id)!,
    width: 183,
    height: 120,
  }));
  const regions = getAllGroupRegions(data, nodes, 42, GROUP_COLORS);
  assert.equal(regions.length, 4);
  for (const node of nodes) {
    const box = regions.find((region) => region.name === node.group)!;
    assert.ok(node.x - node.width / 2 >= box.x + 42);
    assert.ok(node.x + node.width / 2 <= box.x + box.width - 42);
    assert.ok(node.y - node.height / 2 >= box.y + 42 + 48);
  }
  for (let i = 0; i < regions.length; i++)
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i],
        b = regions[j];
      assert.ok(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
      );
    }
});
test('drag updates group bounds without changing input data and empty groups disappear', () => {
  const data = createJourneyDocument(1),
    before = JSON.stringify(data);
  const node = { id: 'wukong', group: '取经团队', x: 0, y: 0, width: 100, height: 60 };
  const a = getAllGroupRegions(data, [node], 42, GROUP_COLORS)[0];
  const b = getAllGroupRegions(data, [{ ...node, x: 400, y: 100 }], 42, GROUP_COLORS)[0];
  assert.equal(b.x - a.x, 400);
  assert.equal(b.y - a.y, 100);
  assert.equal(getAllGroupRegions(data, [], 42, GROUP_COLORS).length, 0);
  assert.equal(JSON.stringify(data), before);
});
