import type { GraphDocument, LayoutName } from './model';
import { findCoreCharacterId } from './semantic-layout.ts';

/** Stable undirected spanning forest: only existing relations form branches. */
export function getAllRootedBranches(document: GraphDocument) {
  const coreId = findCoreCharacterId(document);
  const neighbors = new Map(document.characters.map((p) => [p.id, new Set<string>()]));
  for (const edge of document.relations) {
    if (edge.source === edge.target) continue;
    neighbors.get(edge.source)!.add(edge.target);
    neighbors.get(edge.target)!.add(edge.source);
  }
  const parents = new Map<string, string | null>();
  const depths = new Map<string, number>();
  const children = new Map(document.characters.map((p) => [p.id, [] as string[]]));
  const roots = [
    coreId,
    ...document.characters
      .map((p) => p.id)
      .sort()
      .filter((id) => id !== coreId),
  ];
  for (const root of roots) {
    if (parents.has(root)) continue;
    parents.set(root, null);
    depths.set(root, 0);
    const queue = [root];
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      for (const next of [...neighbors.get(id)!].sort()) {
        if (parents.has(next)) continue;
        parents.set(next, id);
        depths.set(next, depths.get(id)! + 1);
        children.get(id)!.push(next);
        queue.push(next);
      }
    }
  }
  return { coreId, parents, depths, children };
}

export function getAllStructuredPositions(document: GraphDocument, layout: LayoutName) {
  const { coreId, parents, depths, children } = getAllRootedBranches(document);
  const positions = new Map<string, { x: number; y: number }>();
  const ids = [
    coreId,
    ...document.characters
      .map((p) => p.id)
      .filter((id) => id !== coreId)
      .sort(),
  ];
  if (layout === 'grid') {
    const slots = [{ x: 0, y: 0 }];
    for (let radius = 1; slots.length < ids.length; radius++) {
      for (let y = -radius; y <= radius; y++)
        for (let x = -radius; x <= radius; x++) {
          if (Math.max(Math.abs(x), Math.abs(y)) === radius) slots.push({ x: x * 230, y: y * 150 });
        }
    }
    ids.forEach((id, index) => positions.set(id, slots[index]));
    return positions;
  }
  if (layout === 'radial') {
    positions.set(coreId, { x: 0, y: 0 });
    const levels = new Map<number, string[]>();
    for (const id of ids.slice(1)) {
      const depth = Math.max(1, depths.get(id)!);
      levels.set(depth, [...(levels.get(depth) ?? []), id]);
    }
    let previousRadius = 0;
    for (const [depth, members] of [...levels].sort(([a], [b]) => a - b)) {
      const radius = Math.max(previousRadius + 240, depth * 300, members.length * 40);
      members.forEach((id, index) => {
        const angle = (index * Math.PI * 2) / members.length - Math.PI / 2;
        positions.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
      previousRadius = radius;
    }
    return positions;
  }
  const weights = new Map<string, number>();
  const measure = (id: string): number => {
    const weight = Math.max(
      1,
      children.get(id)!.reduce((sum, child) => sum + measure(child), 0),
    );
    weights.set(id, weight);
    return weight;
  };
  const roots = ids.filter((id) => parents.get(id) === null);
  roots.forEach(measure);
  const place = (id: string, depth: number, top: number, side: number): void => {
    const middle = top + weights.get(id)! * 50;
    positions.set(
      id,
      layout === 'tree' ? { x: middle, y: depth * 240 } : { x: side * depth * 280, y: middle },
    );
    let cursor = top;
    for (const child of children.get(id)!) {
      place(child, depth + 1, cursor, side);
      cursor += weights.get(child)! * 100;
    }
  };
  if (layout === 'mindmap') {
    positions.set(coreId, { x: 0, y: 0 });
    const branches = children.get(coreId)!;
    for (const side of [-1, 1]) {
      const subset = branches.filter((_, index) => index % 2 === (side === -1 ? 0 : 1));
      let cursor = -subset.reduce((sum, id) => sum + weights.get(id)! * 100, 0) / 2;
      for (const id of subset) {
        place(id, 1, cursor, side);
        cursor += weights.get(id)! * 100;
      }
    }
    let offset = Math.max(600, ...[...positions.values()].map((p) => p.y)) + 240;
    for (const root of roots.filter((id) => id !== coreId)) {
      place(root, 1, offset, 1);
      offset += weights.get(root)! * 100;
    }
  } else {
    let top = 0;
    for (const root of roots) {
      place(root, 0, top, 1);
      top += weights.get(root)! * 100 + 140;
    }
    const center = positions.get(coreId)!;
    for (const [id, point] of positions)
      positions.set(id, { x: point.x - center.x, y: point.y - center.y });
  }
  return positions;
}
