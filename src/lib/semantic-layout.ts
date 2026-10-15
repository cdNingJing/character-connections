import type { GraphDocument } from './model';

export interface Point {
  x: number;
  y: number;
}
export const HORIZONTAL_GAP = 210;
export const VERTICAL_GAP = 190;

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function findCoreCharacterId(document: GraphDocument): string {
  if (document.coreId) return document.coreId;
  const degree = new Map(document.characters.map((person) => [person.id, 0]));
  for (const relation of document.relations) {
    degree.set(relation.source, (degree.get(relation.source) ?? 0) + 1);
    degree.set(relation.target, (degree.get(relation.target) ?? 0) + 1);
  }
  return [...document.characters].sort(
    (a, b) => degree.get(b.id)! - degree.get(a.id)! || compareIds(a.id, b.id),
  )[0].id;
}

/** Fixed semantic rows; no randomness or array-order-dependent tie breaking. */
export function getAllSemanticPositions(
  document: GraphDocument,
  preservePositions = true,
): Map<string, Point> {
  const coreId = findCoreCharacterId(document);
  const result = new Map<string, Point>();
  const occupied = new Set(['0:0']);
  const core = document.characters.find((person) => person.id === coreId)!;
  result.set(coreId, preservePositions && core.position ? { ...core.position } : { x: 0, y: 0 });
  const sorted = document.characters
    .filter((person) => person.id !== coreId)
    .sort(
      (a, b) =>
        Number(!a.placement) - Number(!b.placement) ||
        (a.placement?.level ?? 0) - (b.placement?.level ?? 0) ||
        (a.placement?.order ?? 0) - (b.placement?.order ?? 0) ||
        compareIds(a.id, b.id),
    );
  for (const person of sorted) {
    let level = person.placement?.level;
    if (level === undefined) {
      const direct = document.relations.find(
        (relation) =>
          (relation.source === coreId && relation.target === person.id) ||
          (relation.target === coreId && relation.source === person.id),
      );
      level = direct?.type === 'mentorship' ? -1 : direct?.type === 'conflict' ? 1 : 0;
    }
    let order = person.placement?.order ?? 0;
    const desired = order;
    let shift = 0;
    while (occupied.has(`${level}:${order}`)) {
      shift++;
      order = desired + (shift % 2 ? Math.ceil(shift / 2) : -Math.ceil(shift / 2));
    }
    occupied.add(`${level}:${order}`);
    result.set(
      person.id,
      preservePositions && person.position
        ? { ...person.position }
        : { x: order * HORIZONTAL_GAP, y: level * VERTICAL_GAP },
    );
  }
  return result;
}

export interface CurveRoute {
  distance: number;
  weight: number;
  obstacleCount: number;
  distances: number[];
  weights: number[];
}

export function sampleQuadraticCurve(
  start: Point,
  end: Point,
  distance: number,
  samples = 24,
): Point[] {
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const control = {
    x: (start.x + end.x) / 2 - ((end.y - start.y) / length) * distance,
    y: (start.y + end.y) / 2 + ((end.x - start.x) / length) * distance,
  };
  return Array.from({ length: samples + 1 }, (_, index) => {
    const t = index / samples;
    return {
      x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
      y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
    };
  });
}

function countCurveObstacles(points: Point[], obstacles: Point[], radius = 55): number {
  return obstacles.filter((obstacle) =>
    points.some((point) => Math.hypot(point.x - obstacle.x, point.y - obstacle.y) < radius),
  ).length;
}

export function sampleCurveRoute(
  start: Point,
  end: Point,
  distances: number[],
  weights: number[],
  samples = 24,
): Point[] {
  if (distances.length === 1) return sampleQuadraticCurve(start, end, distances[0], samples);
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const controls = distances.map((distance, index) => ({
    x: start.x + (end.x - start.x) * weights[index] - ((end.y - start.y) / length) * distance,
    y: start.y + (end.y - start.y) * weights[index] + ((end.x - start.x) / length) * distance,
  }));
  const middle = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return controls.flatMap((control, index) => {
    const a = index === 0 ? start : middle(controls[index - 1], control);
    const b = index === controls.length - 1 ? end : middle(control, controls[index + 1]);
    return Array.from({ length: samples + 1 }, (_, step) => {
      const t = step / samples;
      return {
        x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t * t * b.x,
        y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t * t * b.y,
      };
    });
  });
}

/** Separate lanes by canonical pair, including reverse-direction relationships. */
export function getAllCurveRoutes(
  document: GraphDocument,
  positions: Map<string, Point>,
  curvature = 1,
  obstacleRadius = 55,
): Map<string, CurveRoute> {
  const routes = new Map<string, CurveRoute>();
  const usedLanes = new Map<string, Set<number>>();
  for (const relation of [...document.relations].sort((a, b) => compareIds(a.id, b.id))) {
    const pair = [relation.source, relation.target].sort(compareIds).join('\u0000');
    const lanes = usedLanes.get(pair) ?? new Set<number>();
    usedLanes.set(pair, lanes);
    const direction = relation.source <= relation.target ? 1 : -1;
    const start = positions.get(relation.source)!;
    const end = positions.get(relation.target)!;
    const obstacles = [...positions]
      .filter(([id]) => id !== relation.source && id !== relation.target)
      .map(([, point]) => point);
    let best: CurveRoute | undefined;
    let bestScore = Infinity;
    for (const canonical of [
      44, -44, 88, -88, 140, -140, 210, -210, 310, -310, 440, -440, 620, -620,
    ].map((value) => value * curvature)) {
      if (lanes.has(canonical)) continue;
      const distance = canonical * direction;
      const hits = countCurveObstacles(
        sampleQuadraticCurve(start, end, distance),
        obstacles,
        obstacleRadius,
      );
      const score = hits * 100000 + Math.abs(distance);
      if (score < bestScore) {
        bestScore = score;
        best = {
          distance,
          weight: 0.5,
          obstacleCount: hits,
          distances: [distance],
          weights: [0.5],
        };
      }
    }
    if (!best) {
      let canonical = 700;
      while (lanes.has(canonical)) canonical += 70;
      best = {
        distance: canonical * direction,
        weight: 0.5,
        distances: [canonical * direction],
        weights: [0.5],
        obstacleCount: countCurveObstacles(
          sampleQuadraticCurve(start, end, canonical * direction),
          obstacles,
          obstacleRadius,
        ),
      };
    }
    if (best.obstacleCount > 0) {
      for (const first of [88, -88, 140, -140, 210, -210, 310, -310, 440, -440].map(
        (value) => value * curvature,
      )) {
        if (lanes.has(first)) continue;
        for (const second of [88, -88, 140, -140, 210, -210, 310, -310, 440, -440].map(
          (value) => value * curvature,
        )) {
          const distances = [first * direction, second * direction];
          const weights = [0.25, 0.75];
          const hits = countCurveObstacles(
            sampleCurveRoute(start, end, distances, weights),
            obstacles,
            obstacleRadius,
          );
          const score = hits * 100000 + (Math.abs(first) + Math.abs(second)) * 0.6;
          if (score < bestScore) {
            bestScore = score;
            best = {
              distance: distances[0],
              weight: 0.25,
              distances,
              weights,
              obstacleCount: hits,
            };
          }
        }
      }
    }
    lanes.add(best.distance * direction);
    routes.set(relation.id, best);
  }
  return routes;
}
