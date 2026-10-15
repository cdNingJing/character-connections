import type { LayoutName, GraphOptions } from '../lib/model';
export interface LayoutExample {
  id: LayoutName;
  title: string;
  group: string;
  description: string;
  rule: string;
  appearance: Partial<GraphOptions>;
  stage: number;
}
export const LAYOUT_EXAMPLES: LayoutExample[] = [
  {
    id: 'semantic',
    title: '规则分层图',
    group: '关系布局',
    description: '核心人物居中，按设定的上下层和左右顺序排列，适合有明确阵营和层级的关系。',
    rule: '人物的 placement.level 控制上下层，placement.order 控制左右位置；相同输入得到相同位置。',
    appearance: { edgeShape: 'bezier' },
    stage: 2,
  },
  {
    id: 'groups',
    title: '分组关系图',
    group: '关系布局',
    description: '按人物分组形成多个小群体，适合比较团队、家族和阵营之间的联系。',
    rule: '人物按 group 聚合，分组之间的关系仍然保留。',
    appearance: { edgeShape: 'soft-bezier' },
    stage: 3,
  },
  {
    id: 'mindmap',
    title: '双向思维导图',
    group: '分支布局',
    description: '从中心人物向两侧展开，先看直接关系，再追踪更远的人物。',
    rule: '按已有关系构造稳定的展开分支，额外关系以淡色点线保留。分支不表示师徒、上下级或因果。',
    appearance: { edgeShape: 'horizontal-taxi' },
    stage: 2,
  },
  {
    id: 'tree',
    title: '纵向树形图',
    group: '分支布局',
    description: '从中心人物向下展开，适合沿一条层次顺序理解人物联系。',
    rule: '按与核心人物的连接层次从上到下排列，交叉关系仍保留。',
    appearance: { edgeShape: 'vertical-taxi' },
    stage: 2,
  },
  {
    id: 'horizontal-tree',
    title: '横向树形图',
    group: '分支布局',
    description: '由左至右展开关系，适合名字较长或需要显示人物简介的场景。',
    rule: '以核心人物为起点，每一层向右扩展；不是人物的时间先后顺序。',
    appearance: { edgeShape: 'horizontal-taxi', nodeContent: 'group' },
    stage: 2,
  },
  {
    id: 'radial',
    title: '同心圆关系图',
    group: '分布布局',
    description: '中心人物位于圆心，关系较近的人物排在内圈，较远的排在外圈。',
    rule: '按最短关系步数分圈，各圈按固定 ID 顺序排列；独立人物仍保留。',
    appearance: { edgeShape: 'arc' },
    stage: 3,
  },
  {
    id: 'circle',
    title: '环形关系图',
    group: '分布布局',
    description: '把人物排成环形，适合整体查看联系分布，不强调人物层级。',
    rule: '人物沿圆周排列，连线显示环内联系；画布仍可拖动和缩放。',
    appearance: { edgeShape: 'soft-bezier', nodeShape: 'ellipse' },
    stage: 2,
  },
  {
    id: 'grid',
    title: '网格关系图',
    group: '分布布局',
    description: '按固定网格逐个排列人物，适合对照资料、检查数据和调整人物位置。',
    rule: '核心人物占中心格，其他人物按 ID 顺序填入周围的网格。',
    appearance: { edgeShape: 'round-segments' },
    stage: 2,
  },
];
