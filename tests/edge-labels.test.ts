import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllNonOverlappingLabelPositions,
  getPointAlongPolyline,
} from '../src/lib/edge-labels.ts';
import { parseGraphOptions, parseGraphDocument } from '../src/lib/model.ts';
import { getAllCurveRoutes } from '../src/lib/semantic-layout.ts';
import { createJourneyDocument } from '../src/data/journey.ts';

test('labels move to an available candidate instead of overlapping', () => {
  const inputs = ['a', 'b'].map((id) => ({
    id,
    width: 60,
    height: 20,
    candidates: [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
    ],
  }));
  const result = getAllNonOverlappingLabelPositions(inputs);
  assert.deepEqual(result.get('a'), { x: 0, y: 0 });
  assert.deepEqual(result.get('b'), { x: 0, y: 40 });
  assert.deepEqual(getAllNonOverlappingLabelPositions([...inputs].reverse()), result);
});
test('labels avoid character boxes when possible', () => {
  const result = getAllNonOverlappingLabelPositions(
    [
      {
        id: 'a',
        width: 60,
        height: 20,
        candidates: [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
        ],
      },
    ],
    [{ x: 0, y: 0, width: 100, height: 60 }],
  );
  assert.deepEqual(result.get('a'), { x: 0, y: 100 });
});
test('polyline positions follow segments rather than the diagonal', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];
  assert.deepEqual(getPointAlongPolyline(points, 0.25), { x: 50, y: 0 });
  assert.deepEqual(getPointAlongPolyline(points, 0.75), { x: 100, y: 50 });
  assert.deepEqual(
    getPointAlongPolyline(
      [
        { x: 1, y: 2 },
        { x: 1, y: 2 },
      ],
      0.5,
    ),
    { x: 1, y: 2 },
  );
});
test('edge and label options survive document JSON round trip', () => {
  const document = createJourneyDocument(3);
  document.appearance = parseGraphOptions({
    edgeShape: 'soft-bezier',
    edgeCurvature: 1.7,
    edgeCornerRadius: 50,
    labelFontSize: 16,
    labelMaxWidth: 90,
    labelOffset: -12,
    labelBackground: 'none',
    labelDirection: 'along-edge',
    labelPosition: 'target',
    avoidLabelOverlap: false,
    labels: 'focused',
  });
  assert.deepEqual(
    parseGraphDocument(JSON.parse(JSON.stringify(document))).appearance,
    document.appearance,
  );
  for (const value of [NaN, 0, 2.1, '1'])
    assert.throws(() => parseGraphOptions({ edgeCurvature: value }));
  assert.throws(() => parseGraphOptions({ labelPosition: 'arbitrary' }));
  assert.throws(() => parseGraphOptions({ labelFontSize: 21 }));
});
test('curvature changes route geometry without merging parallel relationships', () => {
  const document = createJourneyDocument(3),
    positions = new Map(document.characters.map((p) => [p.id, p.position!]));
  const gentle = getAllCurveRoutes(document, positions, 0.65),
    strong = getAllCurveRoutes(document, positions, 1.6);
  assert.notDeepEqual(gentle, strong);
  for (const routes of [gentle, strong]) {
    assert.equal(routes.size, 43);
    assert.notEqual(routes.get('r12')!.distance, routes.get('r13')!.distance);
    assert.ok([...routes.values()].every((route) => route.distances.every(Number.isFinite)));
  }
});
