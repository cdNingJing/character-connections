import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGraphDocument,
  parseGraphOptions,
  getAllActiveRelationsByChapter,
  getAllGroupPositions,
  getAllVisibleCharactersByChapter,
} from '../src/lib/model.ts';

const fixture = () => ({
  schemaVersion: 1,
  title: '测试关系图',
  maxChapter: 100,
  characters: [
    { id: 'a', name: '甲', group: 'A', chapter: 1 },
    { id: 'b', name: '乙', group: 'B', chapter: 20 },
    { id: 'c', name: '丙', group: 'A', chapter: 1 },
  ],
  relations: [
    {
      id: 'r1',
      source: 'a',
      target: 'b',
      label: '合作',
      type: 'alliance',
      fromChapter: 20,
      toChapter: 59,
    },
    { id: 'r2', source: 'a', target: 'b', label: '对立', type: 'conflict', fromChapter: 60 },
    { id: 'r3', source: 'a', target: 'b', label: '亲属', type: 'family', fromChapter: 20 },
  ],
});

test('保留同一对人物的多条关系', () => {
  const document = parseGraphDocument(fixture());
  assert.equal(getAllActiveRelationsByChapter(document, 30).length, 2);
});
test('章节回退隐藏人物和后续关系', () => {
  const document = parseGraphDocument(fixture());
  assert.deepEqual(getAllActiveRelationsByChapter(document, 10), []);
  assert.equal(getAllVisibleCharactersByChapter(document, 10).length, 2);
});
test('关系起止章节包含边界，旧关系按时结束', () => {
  const document = parseGraphDocument(fixture());
  assert.deepEqual(
    getAllActiveRelationsByChapter(document, 59).map((relation) => relation.id),
    ['r1', 'r3'],
  );
  assert.deepEqual(
    getAllActiveRelationsByChapter(document, 60).map((relation) => relation.id),
    ['r2', 'r3'],
  );
});
test('拒绝重复 id，包括节点和关系之间重复', () => {
  const document = fixture();
  document.relations[0].id = 'a';
  assert.throws(() => parseGraphDocument(document), /重复/);
});
test('拒绝悬空关系', () => {
  const document = fixture();
  document.relations[0].target = 'missing';
  assert.throws(() => parseGraphDocument(document), /不存在/);
});
test('拒绝早于人物出场的关系', () => {
  const document = fixture();
  document.relations[0].fromChapter = 1;
  assert.throws(() => parseGraphDocument(document), /早于/);
});
test('拒绝逆序或超出范围的章节', () => {
  const document = fixture();
  document.relations[0].toChapter = 10;
  assert.throws(() => parseGraphDocument(document), /范围/);
});
test('拒绝非有限坐标', () => {
  const document = fixture();
  Object.assign(document.characters[0], { position: { x: Infinity, y: 0 } });
  assert.throws(() => parseGraphDocument(document), /position/);
});
test('分组布局结果稳定，不依赖随机数', () => {
  const document = parseGraphDocument(fixture());
  assert.deepEqual(getAllGroupPositions(document), getAllGroupPositions(document));
});
test('导入的固定坐标优先于分组布局', () => {
  const document = parseGraphDocument(fixture());
  document.characters[0].position = { x: 123, y: 456 };
  assert.deepEqual(getAllGroupPositions(document).get('a'), { x: 123, y: 456 });
});
test('外观随 JSON 往返保留', () => {
  const document = {
    ...fixture(),
    appearance: { edgeWidth: 3, edgeShape: 'straight', background: '#123456' },
  };
  const parsed = parseGraphDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(parsed.appearance?.edgeWidth, 3);
  assert.equal(parsed.appearance?.background, '#123456');
});
test('拒绝外部背景 URL 和 SVG data URL', () => {
  assert.throws(
    () => parseGraphOptions({ backgroundImage: 'https://example.com/image.png' }),
    /backgroundImage/,
  );
  assert.throws(
    () => parseGraphOptions({ backgroundImage: 'data:image/svg+xml;base64,PHN2Zz4=' }),
    /backgroundImage/,
  );
});
test('拒绝非法外观枚举和非数字参数', () => {
  assert.throws(() => parseGraphOptions({ edgeShape: 'invalid' }), /不受支持/);
  assert.throws(() => parseGraphOptions({ edgeWidth: '2' }), /范围/);
  assert.throws(() => parseGraphOptions({ duration: Infinity }), /范围/);
});
test('拒绝超出当前版本上限的数据', () => {
  const document = fixture();
  document.characters = Array.from({ length: 501 }, (_, index) => ({
    id: String(index),
    name: '人物',
    group: 'A',
    chapter: 1,
  }));
  assert.throws(() => parseGraphDocument(document), /500/);
});
