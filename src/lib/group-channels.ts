import type { GraphDocument } from './model';
import type { GroupNodeBounds, GroupRegion } from './group-regions';
export interface ChannelPoint {
  x: number;
  y: number;
}
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function doesSegmentCrossRectangle(a: ChannelPoint, b: ChannelPoint, r: Rect): boolean {
  if (a.x === b.x)
    return (
      a.x > r.x &&
      a.x < r.x + r.width &&
      Math.max(a.y, b.y) > r.y &&
      Math.min(a.y, b.y) < r.y + r.height
    );
  if (a.y === b.y)
    return (
      a.y > r.y &&
      a.y < r.y + r.height &&
      Math.max(a.x, b.x) > r.x &&
      Math.min(a.x, b.x) < r.x + r.width
    );
  return true;
}
/** Deterministic orthogonal visibility grid; no node positions are changed. */
export function findChannelPath(
  start: ChannelPoint,
  end: ChannelPoint,
  rectangles: Rect[],
): ChannelPoint[] | undefined {
  const xs = [
    ...new Set([start.x, end.x, ...rectangles.flatMap((r) => [r.x - 16, r.x + r.width + 16])]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([start.y, end.y, ...rectangles.flatMap((r) => [r.y - 16, r.y + r.height + 16])]),
  ].sort((a, b) => a - b);
  const key = (x: number, y: number) => y * xs.length + x;
  const startKey = key(xs.indexOf(start.x), ys.indexOf(start.y)),
    endKey = key(xs.indexOf(end.x), ys.indexOf(end.y));
  const distance = new Map([[startKey, 0]]),
    previous = new Map<number, number>();
  const open = [startKey],
    closed = new Set<number>();
  const point = (id: number) => ({ x: xs[id % xs.length], y: ys[Math.floor(id / xs.length)] });
  const estimate = (id: number) => {
    const p = point(id);
    return (distance.get(id) ?? Infinity) + Math.abs(p.x - end.x) + Math.abs(p.y - end.y);
  };
  while (open.length) {
    open.sort((a, b) => estimate(a) - estimate(b) || a - b);
    const current = open.shift()!;
    if (current === endKey) {
      const path = [end];
      let id = current;
      while (previous.has(id)) {
        id = previous.get(id)!;
        path.unshift(point(id));
      }
      return path;
    }
    if (closed.has(current)) continue;
    closed.add(current);
    const x = current % xs.length,
      y = Math.floor(current / xs.length),
      a = point(current);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
      const next = key(nx, ny),
        b = point(next);
      if (closed.has(next) || rectangles.some((r) => doesSegmentCrossRectangle(a, b, r))) continue;
      const cost = distance.get(current)! + Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (cost >= (distance.get(next) ?? Infinity)) continue;
      distance.set(next, cost);
      previous.set(next, current);
      open.push(next);
    }
  }
}
export function getAllCrossGroupChannelRoutes(
  document: GraphDocument,
  nodes: GroupNodeBounds[],
  regions: GroupRegion[],
) {
  const result = new Map<
    string,
    { points: ChannelPoint[]; distances: number[]; weights: number[] }
  >();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const cache = new Map<string, ChannelPoint[] | undefined>();
  for (const relation of [...document.relations].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const a = byId.get(relation.source),
      b = byId.get(relation.target);
    if (!a || !b || a.group === b.group) continue;
    const ra = regions.find((r) => r.name === a.group),
      rb = regions.find((r) => r.name === b.group);
    if (!ra || !rb) continue;
    const port = (node: GroupNodeBounds, own: GroupRegion, other: GroupRegion): ChannelPoint => {
      const dx = other.x + other.width / 2 - own.x - own.width / 2,
        dy = other.y + other.height / 2 - own.y - own.height / 2;
      return Math.abs(dx) >= Math.abs(dy)
        ? { x: dx > 0 ? own.x + own.width + 20 : own.x - 20, y: node.y }
        : { x: node.x, y: dy > 0 ? own.y + own.height + 20 : own.y - 20 };
    };
    const pa = port(a, ra, rb),
      pb = port(b, rb, ra);
    const internal = (node: GroupNodeBounds, endpoint: ChannelPoint) => {
      const id = `${node.id}:${endpoint.x}:${endpoint.y}`;
      if (!cache.has(id))
        cache.set(
          id,
          findChannelPath(
            node,
            endpoint,
            nodes
              .filter((n) => n.group === node.group && n.id !== node.id)
              .map((n) => ({
                x: n.x - n.width / 2 - 8,
                y: n.y - n.height / 2 - 8,
                width: n.width + 16,
                height: n.height + 16,
              })),
          ),
        );
      return cache.get(id);
    };
    const first = internal(a, pa),
      last = internal(b, pb),
      middle = findChannelPath(pa, pb, regions);
    if (!first || !last || !middle) continue;
    const raw = [...first, ...middle, ...[...last].reverse()];
    const points: ChannelPoint[] = [];
    for (const point of raw) {
      const end = points[points.length - 1];
      if (end && end.x === point.x && end.y === point.y) continue;
      if (points.length > 1) {
        const before = points[points.length - 2];
        if ((before.x === end.x && end.x === point.x) || (before.y === end.y && end.y === point.y))
          points.pop();
      }
      points.push(point);
    }
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy) || 1;
    const bends = points.slice(1, -1);
    if (!bends.length) bends.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    result.set(relation.id, {
      points,
      weights: bends.map((p) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / (length * length)),
      distances: bends.map((p) => ((p.y - a.y) * dx - (p.x - a.x) * dy) / length),
    });
  }
  return result;
}
export function shouldDisplayCrossGroupRelation(
  mode: 'all' | 'selected',
  relation: { id: string; source: string; target: string },
  selection: { kind: 'character' | 'relation'; id: string } | null,
): boolean {
  return (
    mode === 'all' ||
    (!!selection &&
      (selection.kind === 'relation'
        ? selection.id === relation.id
        : selection.id === relation.source || selection.id === relation.target))
  );
}
