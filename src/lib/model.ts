export const LAYOUT_NAMES = [
  'semantic',
  'groups',
  'mindmap',
  'tree',
  'horizontal-tree',
  'radial',
  'circle',
  'grid',
  'force',
] as const;
export interface Character {
  id: string;
  name: string;
  group: string;
  description?: string;
  aliases?: string[];
  tags?: string[];
  attributes?: Record<string, string>;
  chapter?: number;
  position?: { x: number; y: number };
  placement?: { level: number; order: number };
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  description?: string;
  directed?: boolean;
  fromChapter?: number;
  toChapter?: number;
}

export interface CharacterGroup {
  name: string;
  label?: string;
  color?: string;
  description?: string;
}
export interface GraphDocument {
  groups?: CharacterGroup[];
  schemaVersion: 1;
  title: string;
  maxChapter: number;
  characters: Character[];
  relations: Relation[];
  appearance?: GraphOptions;
  coreId?: string;
}

export type LayoutName =
  | 'semantic'
  | 'groups'
  | 'circle'
  | 'force'
  | 'mindmap'
  | 'tree'
  | 'horizontal-tree'
  | 'radial'
  | 'grid';
export type EdgeShape =
  | 'bezier'
  | 'soft-bezier'
  | 'arc'
  | 'round-taxi'
  | 'horizontal-taxi'
  | 'vertical-taxi'
  | 'round-segments'
  | 'straight';
export type TransitionName = 'none' | 'smooth' | 'fade';

export interface GraphOptions {
  nodeShape: 'ellipse' | 'round-rectangle' | 'diamond' | 'hexagon';
  nodeSize: number;
  nodeContent: 'name' | 'group' | 'description' | 'identity';
  showGroupBackground: boolean;
  groupOpacity: number;
  groupPadding: number;
  groupBorder: 'solid' | 'dashed';
  showAliases: boolean;
  showAttributes: boolean;
  showDescription: boolean;
  background: string;
  pattern: 'dots' | 'grid' | 'none';
  backgroundImage: string;
  edgeShape: EdgeShape;
  edgeLine: 'solid' | 'dashed' | 'dotted';
  edgeWidth: number;
  edgeCurvature: number;
  edgeCornerRadius: number;
  labelFontSize: number;
  labelMaxWidth: number;
  labelOffset: number;
  labelBackground: 'pill' | 'plain' | 'none';
  labelDirection: 'horizontal' | 'along-edge';
  labelPosition: 'auto' | 'middle' | 'source' | 'target';
  avoidLabelOverlap: boolean;
  edgeColor: string;
  unifiedEdgeColor: boolean;
  transition: TransitionName;
  duration: number;
  labels: 'related' | 'all' | 'focused' | 'none';
  arrows: boolean;
}

export const DEFAULT_OPTIONS: GraphOptions = {
  nodeShape: 'round-rectangle',
  nodeSize: 56,
  nodeContent: 'name',
  showGroupBackground: false,
  groupOpacity: 0.09,
  groupPadding: 42,
  groupBorder: 'solid',
  showAliases: true,
  showAttributes: true,
  showDescription: true,
  background: '#142c3e',
  pattern: 'dots',
  backgroundImage: '',
  edgeShape: 'bezier',
  edgeLine: 'solid',
  edgeWidth: 1.6,
  edgeCurvature: 1,
  edgeCornerRadius: 24,
  labelFontSize: 12,
  labelMaxWidth: 110,
  labelOffset: 8,
  labelBackground: 'pill',
  labelDirection: 'horizontal',
  labelPosition: 'auto',
  avoidLabelOverlap: true,
  edgeColor: '#8faabd',
  unifiedEdgeColor: false,
  transition: 'smooth',
  duration: 320,
  labels: 'related',
  arrows: true,
};

export const GROUP_COLORS = ['#6bd7bd', '#a5b9ef', '#edb981', '#de98b1', '#9dcf95', '#c5a8e8'];
export const RELATION_COLORS: Record<string, string> = {
  friendship: '#7ed9c6',
  family: '#edb981',
  mentorship: '#a5b9ef',
  conflict: '#ef9eb2',
  alliance: '#9dcf95',
  investigation: '#b5a6ea',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function parseGraphOptions(input: unknown): GraphOptions {
  if (!isRecord(input)) throw new Error('appearance 必须是对象');
  const result = { ...DEFAULT_OPTIONS };
  for (const key of ['background', 'edgeColor'] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(input[key]))
      throw new Error(`${key} 必须是六位十六进制颜色`);
    result[key] = input[key];
  }
  const choices = {
    nodeShape: ['ellipse', 'round-rectangle', 'diamond', 'hexagon'],
    nodeContent: ['name', 'group', 'description', 'identity'],
    groupBorder: ['solid', 'dashed'],
    pattern: ['dots', 'grid', 'none'],
    edgeShape: [
      'bezier',
      'soft-bezier',
      'arc',
      'round-taxi',
      'horizontal-taxi',
      'vertical-taxi',
      'round-segments',
      'straight',
    ],
    edgeLine: ['solid', 'dashed', 'dotted'],
    transition: ['none', 'smooth', 'fade'],
    labels: ['related', 'all', 'focused', 'none'],
    labelBackground: ['pill', 'plain', 'none'],
    labelDirection: ['horizontal', 'along-edge'],
    labelPosition: ['auto', 'middle', 'source', 'target'],
  } as const;
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !(choices[key] as readonly string[]).includes(value))
      throw new Error(`${key} 的值不受支持`);
    Object.assign(result, { [key]: value });
  }
  for (const key of [
    'unifiedEdgeColor',
    'arrows',
    'avoidLabelOverlap',
    'showGroupBackground',
    'showAliases',
    'showAttributes',
    'showDescription',
  ] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean') throw new Error(`${key} 必须是布尔值`);
    result[key] = input[key];
  }
  const numberRanges = {
    groupOpacity: [0.03, 0.3],
    groupPadding: [24, 100],
    edgeWidth: [1, 5],
    duration: [0, 2000],
    nodeSize: [32, 96],
    edgeCurvature: [0.4, 2],
    edgeCornerRadius: [0, 80],
    labelFontSize: [10, 20],
    labelMaxWidth: [60, 240],
    labelOffset: [-30, 30],
  } as const;
  for (const key of Object.keys(numberRanges) as (keyof typeof numberRanges)[]) {
    const value = input[key];
    if (value === undefined) continue;
    const [min, max] = numberRanges[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      throw new Error(`${key} 超出允许范围 ${min}—${max}`);
    result[key] = value;
  }
  if (input.backgroundImage !== undefined) {
    if (
      typeof input.backgroundImage !== 'string' ||
      input.backgroundImage.length > 3 * 1024 * 1024 ||
      (input.backgroundImage !== '' &&
        !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(input.backgroundImage))
    ) {
      throw new Error('backgroundImage 只接受不超过 3 MB 的 PNG、JPEG、WebP data URL');
    }
    result.backgroundImage = input.backgroundImage;
  }
  return result;
}

function requireText(value: unknown, field: string, limit = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new Error(`${field}必须是 1—${limit} 个字符的文本`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : requireText(value, field, 2000);
}

function requireChapter(value: unknown, field: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 100000) {
    throw new Error(`${field}必须是 1—100000 之间的整数`);
  }
  return Number(value);
}

/** Validate external JSON and copy only supported fields. */
export function parseGraphDocument(input: unknown): GraphDocument {
  if (!isRecord(input) || input.schemaVersion !== 1) throw new Error('schemaVersion 必须为 1');
  const title = requireText(input.title, 'title');
  const maxChapter = requireChapter(input.maxChapter, 'maxChapter', 1);
  if (
    !Array.isArray(input.characters) ||
    !input.characters.length ||
    input.characters.length > 500
  ) {
    throw new Error('characters 必须包含 1—500 个人物');
  }
  if (!Array.isArray(input.relations) || input.relations.length > 3000) {
    throw new Error('relations 必须是数组，且不超过 3000 条');
  }
  const ids = new Set<string>();
  const characters = input.characters.map((raw): Character => {
    if (!isRecord(raw)) throw new Error('人物必须是对象');
    const id = requireText(raw.id, '人物 id', 100);
    if (ids.has(id)) throw new Error(`id 重复：${id}`);
    ids.add(id);
    const chapter = requireChapter(raw.chapter, '人物 chapter', 1);
    if (chapter > maxChapter) throw new Error(`人物 ${id} 的 chapter 超出 maxChapter`);
    let position: Character['position'];
    let placement: Character['placement'];
    if (raw.placement !== undefined) {
      if (
        !isRecord(raw.placement) ||
        !Number.isInteger(raw.placement.level) ||
        !Number.isInteger(raw.placement.order) ||
        Math.abs(Number(raw.placement.level)) > 20 ||
        Math.abs(Number(raw.placement.order)) > 100
      )
        throw new Error(`人物 ${id} 的 placement 无效`);
      placement = { level: Number(raw.placement.level), order: Number(raw.placement.order) };
    }
    if (raw.position !== undefined) {
      if (
        !isRecord(raw.position) ||
        typeof raw.position.x !== 'number' ||
        typeof raw.position.y !== 'number' ||
        !Number.isFinite(raw.position.x) ||
        !Number.isFinite(raw.position.y) ||
        Math.abs(raw.position.x) > 100000 ||
        Math.abs(raw.position.y) > 100000
      )
        throw new Error(`人物 ${id} 的 position 无效`);
      position = { x: raw.position.x, y: raw.position.y };
    }
    return {
      id,
      name: requireText(raw.name, '人物 name', 80),
      group: requireText(raw.group, '人物 group', 80),
      description: optionalText(raw.description, '人物 description'),
      aliases: parseTextList(raw.aliases, 'aliases'),
      tags: parseTextList(raw.tags, 'tags'),
      attributes: parseAttributes(raw.attributes),
      chapter,
      position,
      placement,
    };
  });
  const relations = input.relations.map((raw): Relation => {
    if (!isRecord(raw)) throw new Error('关系必须是对象');
    const id = requireText(raw.id, '关系 id', 100);
    if (ids.has(id)) throw new Error(`id 重复：${id}`);
    ids.add(id);
    const source = requireText(raw.source, 'source', 100);
    const target = requireText(raw.target, 'target', 100);
    if (
      !characters.some((person) => person.id === source) ||
      !characters.some((person) => person.id === target)
    )
      throw new Error(`关系 ${id} 引用了不存在的人物`);
    const fromChapter = requireChapter(raw.fromChapter, 'fromChapter', 1);
    const toChapter = requireChapter(raw.toChapter, 'toChapter', maxChapter);
    if (fromChapter > toChapter || toChapter > maxChapter)
      throw new Error(`关系 ${id} 的章节范围无效`);
    const firstAppearance = Math.max(
      characters.find((person) => person.id === source)!.chapter!,
      characters.find((person) => person.id === target)!.chapter!,
    );
    if (fromChapter < firstAppearance) throw new Error(`关系 ${id} 早于人物出场章节`);
    if (raw.directed !== undefined && typeof raw.directed !== 'boolean')
      throw new Error('directed 必须是布尔值');
    return {
      id,
      source,
      target,
      label: requireText(raw.label, '关系 label', 80),
      type: requireText(raw.type, '关系 type', 80),
      description: optionalText(raw.description, '关系 description'),
      directed: raw.directed ?? false,
      fromChapter,
      toChapter,
    };
  });
  return {
    schemaVersion: 1,
    groups: parseAllCharacterGroups(input.groups),
    title,
    maxChapter,
    characters,
    relations,
    appearance: input.appearance === undefined ? undefined : parseGraphOptions(input.appearance),
    coreId: input.coreId === undefined ? undefined : validateCoreId(input.coreId, characters),
  };
}

function validateCoreId(input: unknown, characters: Character[]): string {
  const id = requireText(input, 'coreId', 100);
  if (!characters.some((person) => person.id === id))
    throw new Error('coreId 必须指向已存在的人物');
  return id;
}

export function getAllVisibleCharactersByChapter(
  document: GraphDocument,
  chapter: number,
): Character[] {
  return document.characters.filter((person) => (person.chapter ?? 1) <= chapter);
}

export function getAllActiveRelationsByChapter(
  document: GraphDocument,
  chapter: number,
): Relation[] {
  const visibleIds = new Set(
    getAllVisibleCharactersByChapter(document, chapter).map((person) => person.id),
  );
  return document.relations.filter(
    (relation) =>
      (relation.fromChapter ?? 1) <= chapter &&
      (relation.toChapter ?? document.maxChapter) >= chapter &&
      visibleIds.has(relation.source) &&
      visibleIds.has(relation.target),
  );
}

export function getAllGroupPositions(
  document: GraphDocument,
): Map<string, { x: number; y: number }> {
  const groups = [...new Set(document.characters.map((person) => person.group))].sort();
  const coreId = document.coreId ?? document.characters[0].id;
  const coreGroup = document.characters.find((person) => person.id === coreId)!.group;
  groups.sort((a, b) => (a === coreGroup ? -1 : b === coreGroup ? 1 : a.localeCompare(b)));
  const positions = new Map<string, { x: number; y: number }>();
  const groupColumns = Math.ceil(Math.sqrt(groups.length));
  const dimensions = groups.map((group) => {
    const count = document.characters.filter((person) => person.group === group).length;
    const columns = Math.min(3, Math.ceil(Math.sqrt(count)));
    return {
      columns,
      rows: Math.ceil(count / columns),
      width: columns * 210,
      height: Math.ceil(count / columns) * 140,
    };
  });
  const columnWidths = Array.from(
    { length: groupColumns },
    (_, column) =>
      Math.max(
        ...dimensions
          .filter((_, index) => index % groupColumns === column)
          .map((item) => item.width),
      ) + 220,
  );
  const rowHeights = Array.from(
    { length: Math.ceil(groups.length / groupColumns) },
    (_, row) =>
      Math.max(
        ...dimensions
          .slice(row * groupColumns, (row + 1) * groupColumns)
          .map((item) => item.height),
      ) + 280,
  );
  groups.forEach((group, index) => {
    const members = document.characters
      .filter((person) => person.group === group)
      .sort((a, b) => (a.id === coreId ? -1 : b.id === coreId ? 1 : a.id < b.id ? -1 : 1));
    const { columns, rows } = dimensions[index];
    const originX = columnWidths
      .slice(0, index % groupColumns)
      .reduce((sum, value) => sum + value, 0);
    const originY = rowHeights
      .slice(0, Math.floor(index / groupColumns))
      .reduce((sum, value) => sum + value, 0);
    members.forEach((person, memberIndex) =>
      positions.set(
        person.id,
        person.position ?? {
          x: originX + (memberIndex % columns) * 210,
          y: originY + Math.floor(memberIndex / columns) * 140,
        },
      ),
    );
  });
  if (!document.characters.some((person) => person.position)) {
    const center = positions.get(coreId)!;
    for (const [id, point] of positions)
      positions.set(id, { x: point.x - center.x, y: point.y - center.y });
  }
  return positions;
}

function parseTextList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 30)
    throw new Error(`${field} 必须是最多 30 项的数组`);
  return value.map((item) => requireText(item, field, 100));
}
function parseAttributes(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).length > 30)
    throw new Error('attributes 必须是最多 30 项的对象');
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      requireText(key, '属性名', 80),
      requireText(item, '属性值', 500),
    ]),
  );
}

function parseAllCharacterGroups(value: unknown): CharacterGroup[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 500)
    throw new Error('groups 必须是最多 500 项的数组');
  const names = new Set<string>();
  return value.map((raw) => {
    if (!isRecord(raw)) throw new Error('分组必须是对象');
    const name = requireText(raw.name, '分组 name', 80);
    if (names.has(name)) throw new Error(`分组名称重复：${name}`);
    names.add(name);
    if (
      raw.color !== undefined &&
      (typeof raw.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.color))
    )
      throw new Error('分组 color 必须是六位十六进制颜色');
    return {
      name,
      label: raw.label === undefined ? undefined : requireText(raw.label, '分组 label', 80),
      color: raw.color as string | undefined,
      description: optionalText(raw.description, '分组 description'),
    };
  });
}
