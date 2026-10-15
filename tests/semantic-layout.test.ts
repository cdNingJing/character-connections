import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyDocument, DEMO_STAGES } from '../src/data/journey.ts';
import {
  getAllSemanticPositions,
  getAllCurveRoutes,
  findCoreCharacterId,
  HORIZONTAL_GAP,
  VERTICAL_GAP,
} from '../src/lib/semantic-layout.ts';
import { parseGraphDocument } from '../src/lib/model.ts';

test('演示依次展开 1、5、13、26 个人物', () => {
  assert.deepEqual(
    DEMO_STAGES.map((_, index) => createJourneyDocument(index).characters.length),
    [1, 5, 13, 26],
  );
  for (let stage = 0; stage < 4; stage++)
    assert.doesNotThrow(() => parseGraphDocument(createJourneyDocument(stage)));
});
test('所有阶段孙悟空始终在原点', () => {
  for (let stage = 0; stage < 4; stage++)
    assert.deepEqual(getAllSemanticPositions(createJourneyDocument(stage)).get('wukong'), {
      x: 0,
      y: 0,
    });
});
test('演示展开保持已有坐标，不移除已有关系', () => {
  for (let stage = 1; stage < 4; stage++) {
    const before = createJourneyDocument(stage - 1),
      after = createJourneyDocument(stage);
    const positions = getAllSemanticPositions(after);
    for (const person of before.characters)
      assert.deepEqual(positions.get(person.id), person.position);
    for (const edge of before.relations)
      assert.ok(after.relations.some((item) => item.id === edge.id));
  }
});
test('团队成员同层，上层为神佛，下层为妖怪', () => {
  const positions = getAllSemanticPositions(createJourneyDocument(3), false);
  assert.equal(positions.get('tangseng')!.y, 0);
  assert.equal(positions.get('bajie')!.y, 0);
  assert.equal(positions.get('tangseng')!.x, -HORIZONTAL_GAP);
  assert.equal(positions.get('bajie')!.x, HORIZONTAL_GAP);
  assert.equal(positions.get('guanyin')!.y, -VERTICAL_GAP);
  assert.equal(positions.get('honghaier')!.y, VERTICAL_GAP);
});
test('数据输入顺序不影响规则布局', () => {
  const original = createJourneyDocument(3);
  const reversed = {
    ...original,
    characters: [...original.characters].reverse(),
    relations: [...original.relations].reverse(),
  };
  assert.deepEqual(
    getAllSemanticPositions(original, false),
    getAllSemanticPositions(reversed, false),
  );
});
test('完整示例没有节点坐标重叠', () => {
  const positions = [...getAllSemanticPositions(createJourneyDocument(3), false).values()];
  assert.equal(new Set(positions.map((point) => `${point.x}:${point.y}`)).size, positions.length);
});
test('重复的层级槽位按固定规则分开', () => {
  const document = createJourneyDocument(1);
  for (const person of document.characters) {
    person.placement = { level: 0, order: 0 };
    delete person.position;
  }
  const points = [...getAllSemanticPositions(document, false).values()];
  assert.equal(new Set(points.map((point) => `${point.x}:${point.y}`)).size, 5);
});
test('未指定核心时按连接数和 id 确定核心', () => {
  const document = createJourneyDocument(1);
  delete document.coreId;
  const a = findCoreCharacterId(document);
  document.characters.reverse();
  document.relations.reverse();
  assert.equal(findCoreCharacterId(document), a);
});
test('每条连线默认有弯曲，平行关系使用不同路径', () => {
  const document = createJourneyDocument(3);
  const routes = getAllCurveRoutes(document, getAllSemanticPositions(document));
  assert.equal(routes.size, document.relations.length);
  assert.ok([...routes.values()].every((route) => route.distance !== 0));
  assert.notEqual(routes.get('r12')!.distance, routes.get('r13')!.distance);
  assert.notEqual(routes.get('r22')!.distance, routes.get('r23')!.distance);
  assert.ok([...routes.values()].every((route) => route.obstacleCount === 0));
  assert.ok([...routes.values()].some((route) => route.distances.length > 1));
});
test('曲线绕开直连路径中间的人物', () => {
  const document = createJourneyDocument(0);
  document.characters = [
    { id: 'a', name: '甲', group: 'A' },
    { id: 'b', name: '乙', group: 'A' },
    { id: 'c', name: '丙', group: 'A' },
  ];
  document.coreId = 'a';
  document.relations = [{ id: 'r', source: 'a', target: 'b', type: 'friendship', label: '朋友' }];
  const positions = new Map([
    ['a', { x: -180, y: 0 }],
    ['b', { x: 180, y: 0 }],
    ['c', { x: 0, y: 0 }],
  ]);
  const route = getAllCurveRoutes(document, positions).get('r')!;
  assert.equal(route.obstacleCount, 0);
  assert.ok(Math.abs(route.distance) >= 140);
});
test('反向平行关系不会占用相同的物理曲线路径', () => {
  const document = createJourneyDocument(1);
  document.relations = [
    { id: 'a', source: 'wukong', target: 'tangseng', type: 'friendship', label: '关系一' },
    { id: 'b', source: 'tangseng', target: 'wukong', type: 'friendship', label: '关系二' },
  ];
  const routes = getAllCurveRoutes(document, getAllSemanticPositions(document));
  assert.notEqual(routes.get('a')!.distance, -routes.get('b')!.distance);
});
test('导出导入保留核心与层级约束，拒绝无效约束', () => {
  const document = createJourneyDocument(3),
    parsed = parseGraphDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(parsed.coreId, 'wukong');
  assert.deepEqual(parsed.characters.find((person) => person.id === 'guanyin')!.placement, {
    level: -1,
    order: -1,
  });
  assert.throws(() => parseGraphDocument({ ...document, coreId: 'missing' }), /coreId/);
  document.characters[0].placement = { level: Infinity, order: 0 };
  assert.throws(() => parseGraphDocument(document), /placement/);
});
