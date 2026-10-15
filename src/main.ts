import './styles.css';
import { CharacterGraph } from './lib/character-graph';
import type { Selection } from './lib/character-graph';
import {
  DEFAULT_OPTIONS,
  GROUP_COLORS,
  parseGraphDocument,
  getAllVisibleCharactersByChapter,
  getAllActiveRelationsByChapter,
} from './lib/model';
import type { GraphOptions, LayoutName } from './lib/model';
import { createJourneyDocument, DEMO_STAGES } from './data/journey';

const STORAGE_KEY = 'character-connections-v2';
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
};
const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
let notificationTimer: ReturnType<typeof setTimeout>;
function notify(message: string): void {
  clearTimeout(notificationTimer);
  $('notification').textContent = message;
  $('notification').hidden = false;
  notificationTimer = setTimeout(() => {
    $('notification').hidden = true;
  }, 3200);
}

export const graph = new CharacterGraph($('graph'), createJourneyDocument(0), {}, renderSelection);
let dataSource = 'demo';
let demoStage = 0;
let saveTimer: ReturnType<typeof setTimeout>;
let layoutTimer: ReturnType<typeof setTimeout>;

function saveCurrentProject(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          document: graph.exportGraphDocument(),
          options: graph.options,
          chapter: graph.chapter,
          dataSource,
          demoStage,
        }),
      );
    } catch {
      notify('浏览器存储空间不足或不可用，请导出 JSON 保存');
    }
  }, 200);
}

function renderProjectSummary(): void {
  $('graph-title').textContent = graph.document.title;
  $('core-character').innerHTML = graph.document.characters
    .map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`)
    .join('');
  $<HTMLSelectElement>('core-character').value =
    graph.document.coreId ?? graph.document.characters[0].id;
  $('chapter-row').hidden = graph.document.maxChapter <= 1;
  $('demo-progression').hidden = dataSource !== 'demo';
  $('layout-rules').hidden = true;
  renderDemoProgression();
  const visible = getAllVisibleCharactersByChapter(graph.document, graph.chapter);
  const relations = getAllActiveRelationsByChapter(graph.document, graph.chapter);
  $('data-count').textContent = `${visible.length} 人物 / ${relations.length} 关系`;
  $('chapter-label').textContent = `${graph.chapter} / ${graph.document.maxChapter}`;
  const chapter = $<HTMLInputElement>('chapter');
  chapter.max = String(graph.document.maxChapter);
  chapter.value = String(graph.chapter);
  chapter.setAttribute(
    'aria-valuetext',
    `第 ${graph.chapter} 章，共 ${graph.document.maxChapter} 章`,
  );
  const groups = [...new Set(graph.document.characters.map((person) => person.group))];
  const visibleGroups = new Set(visible.map((person) => person.group));
  $('group-legend').innerHTML = groups
    .filter((group) => visibleGroups.has(group))
    .map(
      (group) =>
        `<span><i style="background:${GROUP_COLORS[groups.indexOf(group) % GROUP_COLORS.length]}"></i>${escapeHtml(group)}</span>`,
    )
    .join('');
  document.title = `${graph.document.title} · 人物关联线`;
}

function renderSelection(selection: Selection): void {
  const activeRelations = getAllActiveRelationsByChapter(graph.document, graph.chapter);
  if (!selection) {
    $('selection-label').textContent = '全部人物关系';
    $('selection-meta').textContent = '';
    $('selection-content').innerHTML =
      '<p class="selection-placeholder">点击人物查看介绍和相关关系，或点击连线查看关系说明。</p>';
    return;
  }
  if (selection.kind === 'character') {
    const person = graph.document.characters.find((item) => item.id === selection.id)!;
    const relations = activeRelations.filter(
      (relation) => relation.source === person.id || relation.target === person.id,
    );
    $('selection-label').textContent = `${person.name}的相关关系`;
    $('selection-meta').textContent = `${person.group} · ${relations.length} 段关系`;
    $('selection-content').innerHTML =
      `<h3 class="selection-name">${escapeHtml(person.name)}</h3><p class="selection-description">${graph.options.showDescription ? escapeHtml(person.description ?? '未填写人物介绍') : ''}</p>${graph.options.showAliases && person.aliases?.length ? `<p class="profile-aliases">别名：${person.aliases.map(escapeHtml).join('、')}</p>` : ''}${
        graph.options.showAttributes && person.attributes
          ? `<dl class="profile-attributes">${Object.entries(person.attributes)
              .map(
                ([key, value]) =>
                  `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`,
              )
              .join('')}</dl>`
          : ''
      }${graph.document.maxChapter > 1 ? `<p class="section-label">第 ${person.chapter ?? 1} 章出场</p>` : ''}<div class="relation-list">${relations
        .map((relation) => {
          const otherId = relation.source === person.id ? relation.target : relation.source;
          const other = graph.document.characters.find((item) => item.id === otherId)!;
          return `<button data-relation="${escapeHtml(relation.id)}">${escapeHtml(other.name)} · ${escapeHtml(relation.label)}</button>`;
        })
        .join('')}</div>`;
  } else {
    const relation = activeRelations.find((item) => item.id === selection.id)!;
    const source = graph.document.characters.find((person) => person.id === relation.source)!;
    const target = graph.document.characters.find((person) => person.id === relation.target)!;
    $('selection-label').textContent = `${source.name}与${target.name}`;
    $('selection-meta').textContent =
      graph.document.maxChapter > 1 ? `第 ${relation.fromChapter ?? 1} 章起` : '关系说明';
    $('selection-content').innerHTML =
      `<h3 class="selection-name">${escapeHtml(relation.label)}</h3><p class="selection-description">${escapeHtml(relation.description ?? '未填写关系说明')}</p><div class="relation-list"><button data-person="${escapeHtml(source.id)}">查看${escapeHtml(source.name)}</button><button data-person="${escapeHtml(target.id)}">查看${escapeHtml(target.name)}</button></div>`;
  }
}

function renderCharacterSearchResults(): void {
  const query = $<HTMLInputElement>('character-search').value.trim().toLocaleLowerCase();
  const results = $('search-results');
  results.hidden = !query;
  if (!query) return;
  const matches = getAllVisibleCharactersByChapter(graph.document, graph.chapter).filter((person) =>
    [
      person.name,
      ...(person.aliases ?? []),
      ...(person.tags ?? []),
      ...Object.values(person.attributes ?? {}),
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query),
  );
  results.innerHTML = matches.length
    ? matches
        .map(
          (person) =>
            `<button data-person="${escapeHtml(person.id)}">${escapeHtml(person.name)}<small>${escapeHtml(person.group)}</small></button>`,
        )
        .join('')
    : '<span class="search-empty">当前章节没有匹配的人物</span>';
}

const optionFields: Record<string, keyof GraphOptions> = {
  'show-group-background': 'showGroupBackground',
  'group-opacity': 'groupOpacity',
  'group-padding': 'groupPadding',
  'group-border': 'groupBorder',
  'node-shape': 'nodeShape',
  'node-size': 'nodeSize',
  'node-content': 'nodeContent',
  'show-aliases': 'showAliases',
  'show-attributes': 'showAttributes',
  'show-description': 'showDescription',
  'background-color': 'background',
  pattern: 'pattern',
  'edge-shape': 'edgeShape',
  'edge-curvature': 'edgeCurvature',
  'edge-corner-radius': 'edgeCornerRadius',
  'label-font-size': 'labelFontSize',
  'label-max-width': 'labelMaxWidth',
  'label-offset': 'labelOffset',
  'label-background': 'labelBackground',
  'label-direction': 'labelDirection',
  'label-position': 'labelPosition',
  'avoid-label-overlap': 'avoidLabelOverlap',
  'edge-line': 'edgeLine',
  'edge-width': 'edgeWidth',
  'edge-color': 'edgeColor',
  'unified-color': 'unifiedEdgeColor',
  transition: 'transition',
  duration: 'duration',
  labels: 'labels',
  arrows: 'arrows',
};

function syncOptionFields(): void {
  for (const [id, key] of Object.entries(optionFields)) {
    const field = $<HTMLInputElement | HTMLSelectElement>(id);
    if (field instanceof HTMLInputElement && field.type === 'checkbox')
      field.checked = Boolean(graph.options[key]);
    else field.value = String(graph.options[key]);
  }
  for (const [id, key] of Object.entries(optionFields)) {
    const output = document.getElementById(`${id}-label`);
    if (
      output &&
      [
        'edgeCurvature',
        'edgeCornerRadius',
        'labelFontSize',
        'labelMaxWidth',
        'labelOffset',
      ].includes(key)
    )
      output.textContent = String(graph.options[key]) + (key === 'edgeCurvature' ? ' 倍' : ' px');
  }
  const curved = ['bezier', 'soft-bezier', 'arc'].includes(graph.options.edgeShape);
  $<HTMLInputElement>('edge-curvature').disabled = !curved;
  $<HTMLInputElement>('edge-corner-radius').disabled =
    curved || graph.options.edgeShape === 'straight';
  $('edge-width-label').textContent = `${graph.options.edgeWidth} px`;
  $('duration-label').textContent = `${graph.options.duration} ms`;
  $('background-file-label').textContent = graph.options.backgroundImage
    ? '已设置背景图片'
    : '未设置图片';
  $('remove-background').hidden = !graph.options.backgroundImage;
  $('edge-help').textContent = curved
    ? '曲线自动分开同一对人物的多条关系，并尽量绕开人物。'
    : '圆角折线适合树形和思维导图；复杂交叉关系建议使用自动绕行曲线。';
}

for (const [id, key] of Object.entries(optionFields)) {
  const field = $<HTMLInputElement | HTMLSelectElement>(id);
  field.addEventListener(
    field instanceof HTMLInputElement && ['range', 'color'].includes(field.type)
      ? 'input'
      : 'change',
    () => {
      const value =
        field instanceof HTMLInputElement && field.type === 'checkbox'
          ? field.checked
          : [
                'groupOpacity',
                'groupPadding',
                'edgeWidth',
                'duration',
                'nodeSize',
                'edgeCurvature',
                'edgeCornerRadius',
                'labelFontSize',
                'labelMaxWidth',
                'labelOffset',
              ].includes(key)
            ? Number(field.value)
            : field.value;
      graph.applyAppearanceOptions({ [key]: value });
      syncOptionFields();
      renderSelection(graph.selection);
      saveCurrentProject();
    },
  );
}

$('character-search').addEventListener('input', renderCharacterSearchResults);
$('chapter').addEventListener('input', () => {
  graph.setChapter(Number($<HTMLInputElement>('chapter').value));
  renderProjectSummary();
  renderSelection(graph.selection);
  renderCharacterSearchResults();
  saveCurrentProject();
});

function renderDemoProgression(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((button) => {
    const active = Number(button.dataset.stage) === demoStage;
    button.setAttribute('aria-current', active ? 'step' : 'false');
  });
  $('stage-description').textContent = DEMO_STAGES[demoStage].description;
  $<HTMLButtonElement>('next-stage').disabled = demoStage === DEMO_STAGES.length - 1;
  $('next-stage').textContent =
    demoStage === DEMO_STAGES.length - 1 ? '已显示全部阶段' : '下一阶段';
}

function setDemoStage(stage: number): void {
  clearTimeout(layoutTimer);
  const preserve = dataSource === 'demo';
  demoStage = Math.max(0, Math.min(3, stage));
  dataSource = 'demo';
  const document = createJourneyDocument(demoStage);
  if (preserve) graph.updateDataPreservingPositions(document);
  else graph.loadData(document);
  $<HTMLSelectElement>('dataset').value = 'demo';
  const selectedLayout = $<HTMLSelectElement>('layout').value as LayoutName;
  if (selectedLayout !== 'semantic') graph.applyLayout(selectedLayout);
  renderProjectSummary();
  graph.selectCharacterById('wukong');
  renderCharacterSearchResults();
  saveCurrentProject();
}
document
  .querySelectorAll<HTMLButtonElement>('[data-stage]')
  .forEach((button) =>
    button.addEventListener('click', () => setDemoStage(Number(button.dataset.stage))),
  );
$('next-stage').addEventListener('click', () => setDemoStage(demoStage + 1));
$('dataset').addEventListener('change', () => {
  if ($<HTMLSelectElement>('dataset').value === 'demo') setDemoStage(0);
});
$('apply-layout').addEventListener('click', () => {
  graph.applyLayout($<HTMLSelectElement>('layout').value as LayoutName);
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(saveCurrentProject, graph.options.duration + 80);
  notify('已重新排列人物');
});
$('core-character').addEventListener('change', () => {
  const id = $<HTMLSelectElement>('core-character').value;
  graph.document.coreId = id;
  graph.core.nodes().forEach((node) => {
    node.data('isCore', node.id() === id);
  });
  graph.applyLayout($<HTMLSelectElement>('layout').value as LayoutName);
  graph.selectCharacterById(id);
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(saveCurrentProject, graph.options.duration + 80);
});
$('clear-selection').addEventListener('click', () => graph.clearSelection());
$('zoom-in').addEventListener('click', () => graph.zoomBy(1.25));
$('zoom-out').addEventListener('click', () => graph.zoomBy(0.8));
$('fit').addEventListener('click', () => graph.fit());
graph.core.on('dragfree', 'node', saveCurrentProject);

function setMobileSettingsOpen(open: boolean): void {
  $('settings-panel').dataset.open = String(open);
  $('settings-backdrop').hidden = !open;
  $('open-settings').setAttribute('aria-expanded', String(open));
  document.querySelector<HTMLElement>('.graph-workspace')!.inert = open;
  document.querySelector<HTMLElement>('.app-header')!.inert = open;
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) $('close-settings').focus();
  else $('open-settings').focus();
}
$('open-settings').addEventListener('click', () => setMobileSettingsOpen(true));
$('close-settings').addEventListener('click', () => setMobileSettingsOpen(false));
$('settings-backdrop').addEventListener('click', () => setMobileSettingsOpen(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('settings-panel').dataset.open === 'true')
    setMobileSettingsOpen(false);
});
window.matchMedia('(min-width: 851px)').addEventListener('change', (event) => {
  if (event.matches && $('settings-panel').dataset.open === 'true') setMobileSettingsOpen(false);
});
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const person = event.target.closest<HTMLElement>('[data-person]');
  if (person) graph.selectCharacterById(person.dataset.person!);
  const relation = event.target.closest<HTMLElement>('[data-relation]');
  if (relation) graph.selectRelationById(relation.dataset.relation!);
});

$('background-file').addEventListener('change', async () => {
  const input = $<HTMLInputElement>('background-file');
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      throw new Error('请选择不超过 2 MB 的 PNG、JPEG 或 WebP 图片');
    }
    const image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
    graph.applyAppearanceOptions({ backgroundImage: image });
    syncOptionFields();
    saveCurrentProject();
    notify('已设置背景图片');
  } catch (error) {
    notify(error instanceof Error ? error.message : '图片读取失败');
  }
  input.value = '';
});
$('remove-background').addEventListener('click', () => {
  graph.applyAppearanceOptions({ backgroundImage: '' });
  syncOptionFields();
  saveCurrentProject();
});
$('reset-appearance').addEventListener('click', () => {
  graph.applyAppearanceOptions({ ...DEFAULT_OPTIONS });
  syncOptionFields();
  saveCurrentProject();
  notify('已恢复默认外观');
});

function downloadJsonFile(value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'character-connections.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
$('export-button').addEventListener('click', () => {
  downloadJsonFile({ ...graph.exportGraphDocument(), appearance: graph.options });
  notify('已导出数据、人物位置和外观设置');
});
$('import-button').addEventListener('click', () => {
  $('import-error').textContent = '';
  $<HTMLDialogElement>('import-dialog').showModal();
});
$('fill-example').addEventListener('click', () => {
  $<HTMLTextAreaElement>('json-input').value = JSON.stringify(createJourneyDocument(3), null, 2);
  $('import-error').textContent = '';
});
$('json-file').addEventListener('change', async () => {
  const input = $<HTMLInputElement>('json-file');
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 4 * 1024 * 1024) throw new Error('JSON 文件不能超过 4 MB');
    $<HTMLTextAreaElement>('json-input').value = await file.text();
    $('import-error').textContent = '';
  } catch (error) {
    $('import-error').textContent = error instanceof Error ? error.message : '文件读取失败';
  }
  input.value = '';
});
$('confirm-import').addEventListener('click', () => {
  try {
    const text = $<HTMLTextAreaElement>('json-input').value;
    if (text.length > 4 * 1024 * 1024) throw new Error('JSON 内容不能超过 4 MB');
    const document = parseGraphDocument(JSON.parse(text));
    graph.loadData(document);
    dataSource = 'imported';
    $<HTMLSelectElement>('dataset').value = 'imported';
    syncOptionFields();
    renderProjectSummary();
    renderSelection(null);
    renderCharacterSearchResults();
    saveCurrentProject();
    $<HTMLDialogElement>('import-dialog').close();
    notify('已导入关系图');
  } catch (error) {
    $('import-error').textContent = error instanceof Error ? error.message : 'JSON 格式错误';
  }
});

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  if (saved) {
    graph.loadData(parseGraphDocument(saved.document));
    if (saved.options) graph.applyAppearanceOptions(saved.options);
    graph.setChapter(Number(saved.chapter) || graph.document.maxChapter);
    dataSource = saved.dataSource === 'demo' ? 'demo' : 'imported';
    demoStage = Number.isInteger(saved.demoStage) ? Math.max(0, Math.min(3, saved.demoStage)) : 0;
    $<HTMLSelectElement>('dataset').value = dataSource;
    graph.fit();
  }
} catch {
  notify('保存的数据不可用，已加载演示数据');
}
syncOptionFields();
renderProjectSummary();
renderSelection(null);
graph.selectCharacterById(graph.document.coreId ?? graph.document.characters[0].id);
requestAnimationFrame(() => graph.fit());

graph.core.on('zoom', () => {
  $('canvas-status').textContent =
    graph.core.zoom() < 0.45 ? '放大查看人物和关系文字' : '拖动人物调整位置';
});
