import './styles.css';
import {
  createCharacterGraph,
  DEFAULT_OPTIONS,
  parseGraphDocument,
  parseGraphOptions,
} from '../lib/index';
import type { CharacterGraphComponent, GraphOptions, GraphDocument } from '../lib/index';
import type { Selection } from '../lib/character-graph';
import { createJourneyDocument } from '../data/journey';
import { LAYOUT_EXAMPLES } from './examples';
import { createIntegrationCode } from './code';
import type { IntegrationLanguage } from './code';

const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing element ${id}`);
  return value as T;
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
let example = LAYOUT_EXAMPLES.find((item) => item.id === 'groups')!;
let data: GraphDocument = createJourneyDocument(example.stage);
let appearance: GraphOptions = parseGraphOptions({ ...DEFAULT_OPTIONS, ...example.appearance });
let chart: CharacterGraphComponent;
let activeTab: 'code' | 'data' = 'code';
let notificationTimer: ReturnType<typeof setTimeout>;
function notify(message: string): void {
  clearTimeout(notificationTimer);
  element('gallery-status').textContent = message;
  element('gallery-status').hidden = false;
  notificationTimer = setTimeout(() => {
    element('gallery-status').hidden = true;
  }, 3000);
}
const groups = [...new Set(LAYOUT_EXAMPLES.map((item) => item.group))];
element('layout-navigation').innerHTML = groups
  .map(
    (group) =>
      `<section class="nav-group"><h2>${group}</h2>${LAYOUT_EXAMPLES.filter(
        (item) => item.group === group,
      )
        .map((item) => `<a href="#${item.id}" data-layout="${item.id}">${item.title}</a>`)
        .join('')}</section>`,
  )
  .join('');

type Control = {
  key: keyof GraphOptions;
  label: string;
  choices?: [string, string][];
  min?: number;
  max?: number;
  step?: number;
  type?: 'color' | 'checkbox';
};
const controlGroups: { title: string; open: boolean; fields: Control[] }[] = [
  {
    title: '人物显示',
    open: true,
    fields: [
      {
        key: 'nodeShape',
        label: '人物形状',
        choices: [
          ['round-rectangle', '圆角矩形'],
          ['ellipse', '圆形'],
          ['diamond', '菱形'],
          ['hexagon', '六边形'],
        ],
      },
      {
        key: 'nodeContent',
        label: '人物文字',
        choices: [
          ['name', '姓名'],
          ['group', '姓名与分组'],
          ['description', '姓名与简介'],
          ['identity', '姓名与身份'],
        ],
      },
      { key: 'nodeSize', label: '人物大小', min: 32, max: 96, step: 4 },
    ],
  },
  {
    title: '连线与文字',
    open: true,
    fields: [
      {
        key: 'edgeShape',
        label: '连线形状',
        choices: [
          ['bezier', '自动绕行曲线'],
          ['soft-bezier', '平缓曲线'],
          ['arc', '弧形曲线'],
          ['round-taxi', '自动圆角折线'],
          ['horizontal-taxi', '横向圆角折线'],
          ['vertical-taxi', '纵向圆角折线'],
          ['round-segments', '圆角分段线'],
          ['straight', '直线'],
        ],
      },
      {
        key: 'labels',
        label: '关系文字',
        choices: [
          ['related', '选中人物的关系'],
          ['all', '全部关系'],
          ['focused', '选中的单条关系'],
          ['none', '不显示'],
        ],
      },
      { key: 'edgeCurvature', label: '弯曲程度', min: 0.4, max: 2, step: 0.1 },
      { key: 'edgeCornerRadius', label: '折线圆角', min: 0, max: 80, step: 2 },
    ],
  },
  {
    title: '更多连线与文字设置',
    open: false,
    fields: [
      {
        key: 'edgeLine',
        label: '线条样式',
        choices: [
          ['solid', '实线'],
          ['dashed', '虚线'],
          ['dotted', '点线'],
        ],
      },
      { key: 'edgeWidth', label: '连线粗细', min: 1, max: 5, step: 0.2 },
      { key: 'unifiedEdgeColor', label: '统一连线颜色', type: 'checkbox' },
      { key: 'edgeColor', label: '连线颜色', type: 'color' },
      { key: 'arrows', label: '显示关系箭头', type: 'checkbox' },
      { key: 'labelFontSize', label: '文字大小', min: 10, max: 20, step: 1 },
      { key: 'labelMaxWidth', label: '换行宽度', min: 60, max: 240, step: 10 },
      { key: 'labelOffset', label: '文字上下偏移', min: -30, max: 30, step: 2 },
      {
        key: 'labelBackground',
        label: '文字底色',
        choices: [
          ['pill', '圆角底色'],
          ['plain', '矩形底色'],
          ['none', '无底色'],
        ],
      },
      {
        key: 'labelDirection',
        label: '文字方向',
        choices: [
          ['horizontal', '保持水平'],
          ['along-edge', '沿连线方向'],
        ],
      },
      {
        key: 'labelPosition',
        label: '文字位置',
        choices: [
          ['auto', '自动分散'],
          ['middle', '连线中间'],
          ['source', '靠近起点'],
          ['target', '靠近终点'],
        ],
      },
      { key: 'avoidLabelOverlap', label: '自动错开文字', type: 'checkbox' },
    ],
  },
  {
    title: '分组背景',
    open: true,
    fields: [
      {
        key: 'crossGroupRouting',
        label: '跨组连线',
        choices: [
          ['curve', '自由曲线'],
          ['channels', '沿组间通道'],
        ],
      },
      { key: 'showGroupBackground', label: '显示分组背景', type: 'checkbox' },
      { key: 'groupOpacity', label: '背景浓度', min: 0.03, max: 0.3, step: 0.01 },
      { key: 'groupPadding', label: '分组内边距', min: 24, max: 100, step: 2 },
      {
        key: 'groupBorder',
        label: '分组边框',
        choices: [
          ['solid', '实线'],
          ['dashed', '虚线'],
        ],
      },
    ],
  },
  {
    title: '背景与切换效果',
    open: false,
    fields: [
      { key: 'background', label: '背景颜色', type: 'color' },
      {
        key: 'pattern',
        label: '背景图案',
        choices: [
          ['dots', '点阵'],
          ['grid', '网格'],
          ['none', '无图案'],
        ],
      },
      {
        key: 'transition',
        label: '切换效果',
        choices: [
          ['smooth', '平滑切换'],
          ['fade', '淡入淡出'],
          ['none', '无动画'],
        ],
      },
      { key: 'duration', label: '动画时长', min: 0, max: 2000, step: 20 },
    ],
  },
];
element('appearance-controls').innerHTML = controlGroups
  .map(
    (group) =>
      `<details class="appearance-group" ${group.open ? 'open' : ''}><summary>${group.title}</summary>${group.fields.map((field) => (field.type === 'checkbox' ? `<label class="check-field"><input type="checkbox" data-option="${field.key}"/>${field.label}</label>` : `<label class="field"><span>${field.label}${field.min !== undefined ? `<output data-output="${field.key}"></output>` : ''}</span>${field.choices ? `<select data-option="${field.key}">${field.choices.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>` : `<input data-option="${field.key}" type="${field.type ?? 'range'}" ${field.min !== undefined ? `min="${field.min}" max="${field.max}" step="${field.step}"` : ''}/>`}</label>`)).join('')}</details>`,
  )
  .join('');
function syncAllControls(): void {
  element<HTMLInputElement>('show-all-cross-relations').checked =
    appearance.crossGroupVisibility === 'all';
  for (const field of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    '[data-option]',
  )) {
    const key = field.dataset.option as keyof GraphOptions;
    if (field instanceof HTMLInputElement && field.type === 'checkbox')
      field.checked = Boolean(appearance[key]);
    else field.value = String(appearance[key]);
    const output = document.querySelector<HTMLOutputElement>(`[data-output="${key}"]`);
    if (output) output.value = String(appearance[key]);
  }
  const curved = ['bezier', 'soft-bezier', 'arc'].includes(appearance.edgeShape);
  document.querySelector<HTMLInputElement>('[data-option="edgeCurvature"]')!.disabled = !curved;
  document.querySelector<HTMLInputElement>('[data-option="edgeCornerRadius"]')!.disabled =
    curved || appearance.edgeShape === 'straight';
}
function syncAllSourcePanels(updateData = true): void {
  const language = element<HTMLSelectElement>('integration-language').value as IntegrationLanguage;
  element('example-code').textContent = createIntegrationCode(example.id, appearance, language);
  if (updateData)
    element<HTMLTextAreaElement>('example-data').value = JSON.stringify(data, null, 2);
  element('data-error').textContent = '';
}
function renderSelection(selection: Selection): void {
  const panel = element('selection-detail');
  if (!selection) {
    panel.textContent = '点击人物查看相关关系，点击连线查看关系说明。其他人物始终保留。';
    return;
  }
  if (selection.kind === 'character') {
    const person = data.characters.find((item) => item.id === selection.id);
    if (!person) return;
    panel.innerHTML = `<strong>${escapeHtml(person.name)}</strong>${escapeHtml(person.description ?? person.group)}`;
  } else {
    const relation = data.relations.find((item) => item.id === selection.id);
    if (!relation) return;
    panel.innerHTML = `<strong>${escapeHtml(relation.label)}</strong>${escapeHtml(relation.description ?? '未填写关系说明')}`;
  }
}
function refreshDataSummary(): void {
  element('example-count').textContent =
    `${data.characters.length} 人物 / ${data.relations.length} 关系`;
  element('example-core').innerHTML = data.characters
    .map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`)
    .join('');
  element<HTMLSelectElement>('example-core').value = data.coreId ?? data.characters[0].id;
}
function loadExampleByHash(): void {
  const id = location.hash.slice(1);
  example =
    LAYOUT_EXAMPLES.find((item) => item.id === id) ??
    LAYOUT_EXAMPLES.find((item) => item.id === 'groups')!;
  data = createJourneyDocument(example.stage);
  appearance = parseGraphOptions({ ...DEFAULT_OPTIONS, ...example.appearance });
  element('example-title').textContent = example.title;
  element('example-description').textContent = example.description;
  element('layout-explanation').textContent = example.rule;
  element<HTMLSelectElement>('example-stage').value = String(example.stage);
  document.title = `${example.title} · 人物关联线`;
  for (const link of document.querySelectorAll<HTMLElement>('[data-layout]'))
    link.setAttribute('aria-current', link.dataset.layout === example.id ? 'page' : 'false');
  if (chart) chart.update({ data, appearance, layout: example.id });
  else
    chart = createCharacterGraph(element('example-graph'), {
      data,
      appearance,
      layout: example.id,
      onSelectionChange: renderSelection,
    });
  if (example.id === 'groups') chart.graph.clearSelection();
  else chart.graph.selectCharacterById(data.coreId ?? data.characters[0].id);
  refreshDataSummary();
  syncAllControls();
  syncAllSourcePanels();
}
element('appearance-controls').addEventListener('input', (event) => {
  const field = event.target as HTMLInputElement | HTMLSelectElement;
  if (!field.dataset.option) return;
  const value =
    field instanceof HTMLInputElement && field.type === 'checkbox'
      ? field.checked
      : field.type === 'range'
        ? Number(field.value)
        : field.value;
  appearance = parseGraphOptions({ ...appearance, [field.dataset.option]: value });
  chart.update({ appearance });
  syncAllControls();
  syncAllSourcePanels(false);
});
element('example-stage').addEventListener('change', () => {
  data = createJourneyDocument(Number(element<HTMLSelectElement>('example-stage').value));
  chart.update({ data, appearance, layout: example.id });
  if (example.id === 'groups') chart.graph.clearSelection();
  else chart.graph.selectCharacterById(data.coreId!);
  refreshDataSummary();
  syncAllSourcePanels();
});
element('example-core').addEventListener('change', () => {
  data = { ...data, coreId: element<HTMLSelectElement>('example-core').value };
  chart.update({ data, appearance, layout: example.id });
  if (example.id === 'groups') chart.graph.clearSelection();
  else chart.graph.selectCharacterById(data.coreId!);
  syncAllSourcePanels();
});
window.addEventListener('hashchange', loadExampleByHash);
element('reset-example').addEventListener('click', loadExampleByHash);
element('fit-example').addEventListener('click', () => chart.fit());
element('clear-selection').addEventListener('click', () => chart.graph.clearSelection());
element('integration-language').addEventListener('change', () => {
  element('example-code').textContent = createIntegrationCode(
    example.id,
    appearance,
    element<HTMLSelectElement>('integration-language').value as IntegrationLanguage,
  );
});
function selectSourceTab(tab: 'code' | 'data'): void {
  activeTab = tab;
  for (const name of ['code', 'data']) {
    element(`${name}-tab`).setAttribute('aria-selected', String(name === tab));
    element(`${name}-panel`).hidden = name !== tab;
    element(`${name}-tab`).tabIndex = name === tab ? 0 : -1;
  }
  element('copy-source').textContent = tab === 'code' ? '复制代码' : '复制数据';
}
for (const tab of ['code', 'data'] as const)
  element(`${tab}-tab`).addEventListener('click', () => selectSourceTab(tab));
document.querySelector('.source-tabs')!.addEventListener('keydown', (event) => {
  const key = event as KeyboardEvent;
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key.key)) {
    key.preventDefault();
    selectSourceTab(
      key.key === 'Home'
        ? 'code'
        : key.key === 'End'
          ? 'data'
          : activeTab === 'code'
            ? 'data'
            : 'code',
    );
    element(`${activeTab}-tab`).focus();
  }
});
element('copy-source').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(
      activeTab === 'code'
        ? (element('example-code').textContent ?? '')
        : element<HTMLTextAreaElement>('example-data').value,
    );
    notify(activeTab === 'code' ? '已复制调用代码' : '已复制示例数据');
  } catch {
    notify('复制失败，请选中内容后手动复制');
  }
});
element('download-data').addEventListener('click', () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'graph-data.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
element('apply-data').addEventListener('click', () => {
  try {
    const text = element<HTMLTextAreaElement>('example-data').value;
    if (text.length > 4 * 1024 * 1024) throw new Error('JSON 不能超过 4 MB');
    const parsed = parseGraphDocument(JSON.parse(text));
    const nextAppearance = parsed.appearance ? parseGraphOptions(parsed.appearance) : appearance;
    chart.update({ data: parsed, appearance: nextAppearance, layout: example.id });
    data = parsed;
    appearance = nextAppearance;
    chart.graph.clearSelection();
    refreshDataSummary();
    syncAllControls();
    syncAllSourcePanels();
    notify('已应用数据，调用代码已同步');
  } catch (error) {
    element('data-error').textContent = error instanceof Error ? error.message : '数据格式错误';
  }
});
element('open-guide').addEventListener('click', () =>
  element<HTMLDialogElement>('integration-guide').showModal(),
);
element('close-guide').addEventListener('click', () =>
  element<HTMLDialogElement>('integration-guide').close(),
);
element<HTMLAnchorElement>('download-package').href = import.meta.env.DEV
  ? './dist/character-connections-0.7.0.tgz'
  : './character-connections-0.7.0.tgz';
selectSourceTab('code');
loadExampleByHash();
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) chart.destroy();
});

element<HTMLAnchorElement>('download-package-guide').href =
  element<HTMLAnchorElement>('download-package').href;
function setParametersCollapsed(collapsed: boolean): void {
  document.querySelector<HTMLElement>('.parameters-panel')!.dataset.collapsed = String(collapsed);
  element('toggle-parameters').setAttribute('aria-expanded', String(!collapsed));
  element('toggle-parameters').textContent = collapsed ? '展开参数' : '收起参数';
}
element('toggle-parameters').addEventListener('click', () =>
  setParametersCollapsed(
    document.querySelector<HTMLElement>('.parameters-panel')!.dataset.collapsed !== 'true',
  ),
);
setParametersCollapsed(window.matchMedia('(max-width:700px)').matches);

element('zoom-in-example').addEventListener('click', () => chart.graph.zoomBy(1.4));
element('zoom-out-example').addEventListener('click', () => chart.graph.zoomBy(1 / 1.4));

element('show-all-cross-relations').addEventListener('change', () => {
  appearance = parseGraphOptions({
    ...appearance,
    crossGroupVisibility: element<HTMLInputElement>('show-all-cross-relations').checked
      ? 'all'
      : 'selected',
  });
  chart.update({ appearance });
  syncAllControls();
  syncAllSourcePanels(false);
});
