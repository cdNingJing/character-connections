import type { Character, GraphDocument, LayoutName, GraphOptions, Relation } from './model';
import { getAllRootedBranches } from './structured-layout.ts';
export interface NotebookSection {
  title: string;
  characters: Character[];
}
export type NotebookPage =
  | { kind: 'characters'; sections: NotebookSection[] }
  | { kind: 'relations'; relations: Relation[] };
/** Fixed-size page budgets: cards and relation rows never share geometry. */
export function createAllNotebookPages(
  document: GraphDocument,
  layout: LayoutName,
  options: GraphOptions,
  selection: { kind: 'character' | 'relation'; id: string } | null,
): NotebookPage[] {
  const sections: NotebookSection[] = [];
  const branching = ['mindmap', 'tree', 'horizontal-tree', 'radial'].includes(layout);
  const depths = branching ? getAllRootedBranches(document).depths : undefined;
  const sectionKey = (person: Character) =>
    layout === 'semantic'
      ? `第 ${person.placement?.level ?? 0} 层`
      : depths
        ? depths.get(person.id) === 0
          ? '中心人物'
          : `${depths.get(person.id)} 层关系`
        : person.group;
  const keys = [...new Set(document.characters.map(sectionKey))];
  if (layout === 'semantic')
    keys.sort((a, b) => Number(a.match(/-?\d+/)?.[0]) - Number(b.match(/-?\d+/)?.[0]));
  if (depths)
    keys.sort((a, b) =>
      a === '中心人物'
        ? -1
        : b === '中心人物'
          ? 1
          : Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]),
    );
  for (const key of keys) {
    const members = document.characters.filter((person) => sectionKey(person) === key);
    for (let offset = 0; offset < members.length; offset += 12)
      sections.push({
        title: key + (offset ? '（续）' : ''),
        characters: members.slice(offset, offset + 12),
      });
  }
  const pages: NotebookPage[] = [];
  let current: NotebookSection[] = [],
    height = 0;
  for (const section of sections) {
    const required = 46 + Math.ceil(section.characters.length / 4) * 68;
    if (height + required > 820 && current.length) {
      pages.push({ kind: 'characters', sections: current });
      current = [];
      height = 0;
    }
    current.push(section);
    height += required;
  }
  if (current.length) pages.push({ kind: 'characters', sections: current });
  const byId = new Map(document.characters.map((person) => [person.id, person]));
  const relations = document.relations.filter((edge) => {
    if (options.crossGroupVisibility === 'all') return true;
    if (byId.get(edge.source)?.group === byId.get(edge.target)?.group) return true;
    return (
      !!selection &&
      (selection.kind === 'character'
        ? edge.source === selection.id || edge.target === selection.id
        : edge.id === selection.id)
    );
  });
  for (let index = 0; index < relations.length; index += 11)
    pages.push({ kind: 'relations', relations: relations.slice(index, index + 11) });
  return pages;
}
