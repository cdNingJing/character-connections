import type { GraphDocument } from './model';
export interface GroupNodeBounds {
  id: string;
  group: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface GroupRegion {
  name: string;
  label: string;
  color: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
}
/** Bounds follow actual node bodies; regions never alter node positions or create graph nodes. */
export function getAllGroupRegions(
  document: GraphDocument,
  nodes: GroupNodeBounds[],
  padding: number,
  colors: string[],
): GroupRegion[] {
  const groups = [...new Set(document.characters.map((person) => person.group))];
  return groups.flatMap((name, index) => {
    const members = nodes.filter((node) => node.group === name);
    if (!members.length) return [];
    const metadata = document.groups?.find((group) => group.name === name);
    const left = Math.min(...members.map((node) => node.x - node.width / 2)) - padding;
    const right = Math.max(...members.map((node) => node.x + node.width / 2)) + padding;
    const top = Math.min(...members.map((node) => node.y - node.height / 2)) - padding - 48;
    const bottom = Math.max(...members.map((node) => node.y + node.height / 2)) + padding;
    return [
      {
        name,
        label: metadata?.label ?? name,
        color: metadata?.color ?? colors[index % colors.length],
        description: metadata?.description,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        count: members.length,
      },
    ];
  });
}
