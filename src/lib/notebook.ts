import './notebook.css';
import { LAYOUT_NAMES, parseGraphDocument, parseGraphOptions } from './model';
import type { GraphDocument, GraphOptions, LayoutName } from './model';
import type { Selection } from './character-graph';
export interface CharacterNotebookProps {
  data: GraphDocument;
  layout?: LayoutName;
  characterId?: string;
  appearance?: Partial<GraphOptions>;
  onSelectionChange?: (selection: Selection) => void;
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
export class CharacterNotebook {
  private props: CharacterNotebookProps;
  private selection: Selection = null;
  private observer: ResizeObserver;
  private destroyed = false;
  private clickHandler = (event: Event) => {
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-notebook-person],[data-notebook-relation]',
    );
    if (!target) return;
    const selection: Selection = target.dataset.notebookPerson
      ? { kind: 'character', id: target.dataset.notebookPerson }
      : { kind: 'relation', id: target.dataset.notebookRelation! };
    this.setSelection(selection);
    this.props.onSelectionChange?.(selection);
  };
  constructor(
    private host: HTMLElement,
    props: CharacterNotebookProps,
  ) {
    if (props.layout && !LAYOUT_NAMES.includes(props.layout)) throw new Error('不支持的布局');
    const appearance = parseGraphOptions(props.appearance ?? props.data.appearance ?? {});
    this.props = { ...props, appearance, data: parseGraphDocument(props.data) };
    host.dataset.characterNotebook = '';
    host.addEventListener('click', this.clickHandler);
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(host);
    this.render();
  }
  update(props: Partial<CharacterNotebookProps>): void {
    if (this.destroyed) throw new Error('笔记组件已销毁');
    if (props.layout && !LAYOUT_NAMES.includes(props.layout)) throw new Error('不支持的布局');
    const next = {
      ...this.props,
      ...props,
      data: props.data ? parseGraphDocument(props.data) : this.props.data,
      appearance: { ...this.props.appearance, ...props.appearance },
    };
    parseGraphOptions(next.appearance ?? {});
    this.props = next;
    if (props.characterId !== undefined) this.selection = null;
    this.render();
  }
  setSelection(selection: Selection): void {
    this.selection = selection;
    this.render();
  }
  fit(): void {
    const scale = Math.min(1, Math.max(1, this.host.clientWidth - 32) / 794);
    for (const slot of this.host.querySelectorAll<HTMLElement>('.notebook-page-slot')) {
      slot.style.width = `${794 * scale}px`;
      slot.style.height = `${1123 * scale}px`;
      slot.querySelector<HTMLElement>('.notebook-sheet')!.style.transform = `scale(${scale})`;
    }
  }
  exportData(): GraphDocument {
    return parseGraphDocument({
      ...this.props.data,
      appearance: parseGraphOptions(this.props.appearance ?? {}),
    });
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer.disconnect();
    this.host.removeEventListener('click', this.clickHandler);
    this.host.replaceChildren();
    delete this.host.dataset.characterNotebook;
  }
  private render(): void {
    if (this.destroyed) return;
    const data = this.props.data;
    const selectedId =
      this.selection?.kind === 'character' ? this.selection.id : this.props.characterId;
    const person =
      data.characters.find((item) => item.id === selectedId) ??
      data.characters.find((item) => item.id === data.coreId) ??
      data.characters[0];
    if (!person) {
      this.host.replaceChildren();
      return;
    }
    const attributes = Object.entries(person.attributes ?? {});
    const related = data.relations.filter(
      (item) => item.source === person.id || item.target === person.id,
    );
    const relationPages = [related.slice(0, 4)];
    for (let index = 4; index < related.length; index += 7) {
      relationPages.push(related.slice(index, index + 7));
    }
    const active = globalThis.document.activeElement as HTMLElement | null;
    const focusPerson = this.host.contains(active) ? active?.dataset.notebookPerson : undefined;
    const focusRelation = this.host.contains(active) ? active?.dataset.notebookRelation : undefined;
    this.host.innerHTML = relationPages
      .map(
        (relations, index) => `
      <div class="notebook-page-slot"><article class="notebook-sheet profile-sheet" aria-label="${escapeHtml(person.name)}人物简介，第 ${index + 1} 页">
      <header class="profile-header"><span>《${escapeHtml(data.title.replace(/西游记.*/, '西游记'))}》 · 人物档案</span>
      <h2>${escapeHtml(person.name)}</h2><p>${escapeHtml(person.group)}${index ? ' · 相关人物（续）' : ''}</p></header>
      <div class="profile-columns"><aside class="profile-sidebar"><div class="profile-monogram" aria-hidden="true">${escapeHtml(person.name.slice(0, 1))}</div>
      <h3>人物档案</h3><dl><dt>所属分组</dt><dd>${escapeHtml(person.group)}</dd>
      ${attributes
        .filter(([key]) => key !== '主要经历')
        .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
        .join('')}</dl>
      ${person.aliases?.length ? `<h3>别名与称号</h3><ul>${person.aliases.map((alias) => `<li>${escapeHtml(alias)}</li>`).join('')}</ul>` : ''}
      ${person.tags?.length ? `<h3>人物标签</h3><p>${person.tags.map(escapeHtml).join(' · ')}</p>` : ''}</aside>
      <main class="profile-main">${
        index === 0
          ? `<section><h3>人物简介</h3><p class="profile-intro">${escapeHtml(person.description ?? '暂无人物简介。')}</p></section>
      ${
        person.attributes?.['主要经历']
          ? `<section><h3>主要经历</h3><ol class="profile-experiences">${person.attributes[
              '主要经历'
            ]
              .split(/[、；]/)
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')}</ol></section>`
          : ''
      }`
          : ''
      }
      <section><h3>相关人物 <small>共 ${related.length} 条关系${relationPages.length > 1 ? ` · 第 ${index + 1} 页` : ''}</small></h3>
      <div class="profile-relations">${
        relations
          .map((relation) => {
            const other = data.characters.find(
              (item) =>
                item.id === (relation.source === person.id ? relation.target : relation.source),
            )!;
            const source = data.characters.find((item) => item.id === relation.source)!;
            const target = data.characters.find((item) => item.id === relation.target)!;
            return `<div class="profile-relation"><button data-notebook-person="${escapeHtml(other.id)}">${escapeHtml(other.name)}</button><span>${escapeHtml(source.name)} ${relation.directed ? '→' : '—'} ${escapeHtml(target.name)} · ${escapeHtml(relation.label)}</span>${relation.description ? `<p>${escapeHtml(relation.description)}</p>` : ''}</div>`;
          })
          .join('') || '<p>当前数据暂无相关人物。</p>'
      }</div></section></main></div>
      <footer class="notebook-footer"><span>人物资料 · A4 / 210 × 297 mm</span><span>${index + 1} / ${relationPages.length}</span></footer>
      </article></div>`,
      )
      .join('');
    this.fit();
    if (focusPerson || focusRelation) {
      const target = [
        ...this.host.querySelectorAll<HTMLElement>(
          '[data-notebook-person],[data-notebook-relation]',
        ),
      ].find((button) =>
        focusPerson
          ? button.dataset.notebookPerson === focusPerson
          : button.dataset.notebookRelation === focusRelation,
      );
      target?.focus({ preventScroll: true });
    }
  }
}
export function createCharacterNotebook(
  host: HTMLElement,
  props: CharacterNotebookProps,
): CharacterNotebook {
  return new CharacterNotebook(host, props);
}
