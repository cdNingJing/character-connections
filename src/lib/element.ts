import { createCharacterGraph } from './component';
import type { CharacterGraphComponent } from './component';
import { parseGraphDocument, parseGraphOptions, LAYOUT_NAMES } from './model';
import type { GraphDocument, GraphOptions, LayoutName } from './model';

// Importing the package during SSR is safe. Register elements in the browser only.
const ElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;
export class CharacterConnectionsElement extends ElementBase {
  static observedAttributes = ['layout'];
  private currentData?: GraphDocument;
  private currentOptions: Partial<GraphOptions> = {};
  private currentLayout: LayoutName = 'semantic';
  private component?: CharacterGraphComponent;
  private chartHost?: HTMLDivElement;
  get data(): GraphDocument | undefined {
    return this.currentData;
  }
  set data(value: GraphDocument) {
    const parsed = parseGraphDocument(value);
    this.component?.update({ data: parsed });
    this.currentData = parsed;
    this.mountGraph();
  }
  get options(): Partial<GraphOptions> {
    return { ...this.currentOptions };
  }
  set options(value: Partial<GraphOptions>) {
    const parsed = parseGraphOptions({ ...this.currentOptions, ...value });
    this.component?.update({ appearance: parsed });
    this.currentOptions = parsed;
  }
  get layout(): LayoutName {
    return this.currentLayout;
  }
  set layout(value: LayoutName) {
    if (!LAYOUT_NAMES.includes(value)) throw new Error('不支持的布局方式');
    this.setAttribute('layout', value);
  }
  connectedCallback(): void {
    for (const key of ['data', 'options', 'layout'] as const) {
      if (!Object.prototype.hasOwnProperty.call(this, key)) continue;
      const value = this[key];
      Reflect.deleteProperty(this, key);
      Reflect.set(this, key, value);
    }
    this.mountGraph();
  }
  disconnectedCallback(): void {
    queueMicrotask(() => {
      if (this.isConnected) return;
      if (this.component) this.currentData = this.component.exportData();
      this.component?.destroy();
      this.component = undefined;
      this.chartHost?.remove();
      this.chartHost = undefined;
    });
  }
  attributeChangedCallback(_name: string, _old: string | null, value: string | null): void {
    const layout = value ?? 'semantic';
    if (!LAYOUT_NAMES.includes(layout as LayoutName)) {
      this.dispatchEvent(new CustomEvent('graph-error', { detail: new Error('不支持的布局方式') }));
      return;
    }
    this.currentLayout = layout as LayoutName;
    this.component?.update({ layout: this.currentLayout });
  }
  private mountGraph(): void {
    if (!this.isConnected || !this.currentData || this.component) return;
    this.chartHost = document.createElement('div');
    this.chartHost.style.cssText = 'width:100%;height:100%;min-height:inherit';
    this.append(this.chartHost);
    this.component = createCharacterGraph(this.chartHost, {
      data: this.currentData,
      appearance: this.currentOptions,
      layout: this.currentLayout,
      onSelectionChange: (selection) =>
        this.dispatchEvent(
          new CustomEvent('selection-change', { detail: selection, bubbles: true, composed: true }),
        ),
    });
  }
  fit(): void {
    this.component?.fit();
  }
  exportData(): GraphDocument | undefined {
    return this.component?.exportData() ?? this.currentData;
  }
}
/** Explicit registration avoids global side effects on import. */
export function registerCharacterConnections(tagName = 'character-connections'): void {
  if (!globalThis.customElements) throw new Error('请在浏览器中注册组件');
  const existing = customElements.get(tagName);
  if (existing) {
    if (existing !== CharacterConnectionsElement) throw new Error(`${tagName} 已被其他组件注册`);
    return;
  }
  customElements.define(tagName, CharacterConnectionsElement);
}
declare global {
  interface HTMLElementTagNameMap {
    'character-connections': CharacterConnectionsElement;
  }
}

import { createCharacterNotebook } from './notebook';
import type { CharacterNotebook } from './notebook';
export class CharacterNotebookElement extends ElementBase {
  static observedAttributes = ['layout', 'character-id'];
  get characterId(): string {
    return this.getAttribute('character-id') ?? '';
  }
  set characterId(value: string) {
    this.setAttribute('character-id', value);
  }
  private currentData?: GraphDocument;
  private currentOptions: Partial<GraphOptions> = {};
  private instance?: CharacterNotebook;
  get data(): GraphDocument | undefined {
    return this.currentData;
  }
  set data(value: GraphDocument) {
    const parsed = parseGraphDocument(value);
    this.instance?.update({ data: parsed });
    this.currentData = parsed;
    this.mountNotebook();
  }
  get options(): Partial<GraphOptions> {
    return { ...this.currentOptions };
  }
  set options(value: Partial<GraphOptions>) {
    const parsed = parseGraphOptions({ ...this.currentOptions, ...value });
    this.instance?.update({ appearance: parsed });
    this.currentOptions = parsed;
  }
  get layout(): LayoutName {
    return (this.getAttribute('layout') ?? 'groups') as LayoutName;
  }
  set layout(value: LayoutName) {
    if (!LAYOUT_NAMES.includes(value)) throw new Error('不支持的布局');
    this.setAttribute('layout', value);
  }
  attributeChangedCallback(): void {
    if (!LAYOUT_NAMES.includes(this.layout)) throw new Error('不支持的布局');
    this.instance?.update({ layout: this.layout, characterId: this.characterId });
  }
  connectedCallback(): void {
    for (const key of ['data', 'options', 'layout', 'characterId'] as const)
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        const value = this[key];
        Reflect.deleteProperty(this, key);
        Reflect.set(this, key, value);
      }
    this.mountNotebook();
  }
  disconnectedCallback(): void {
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.instance?.destroy();
      this.instance = undefined;
    });
  }
  private mountNotebook(): void {
    if (!this.isConnected || !this.currentData || this.instance) return;
    this.instance = createCharacterNotebook(this, {
      data: this.currentData,
      appearance: this.currentOptions,
      layout: this.layout,
      characterId: this.characterId,
      onSelectionChange: (selection) =>
        this.dispatchEvent(
          new CustomEvent('selection-change', { detail: selection, bubbles: true, composed: true }),
        ),
    });
  }
  fit(): void {
    this.instance?.fit();
  }
  exportData(): GraphDocument | undefined {
    return this.instance?.exportData() ?? this.currentData;
  }
}
export function registerCharacterNotebook(): void {
  if (!globalThis.customElements) throw new Error('请在浏览器中注册笔记组件');
  const existing = customElements.get('character-notebook');
  if (existing && existing !== CharacterNotebookElement)
    throw new Error('character-notebook 已被其他组件注册');
  if (!existing) customElements.define('character-notebook', CharacterNotebookElement);
}
declare global {
  interface HTMLElementTagNameMap {
    'character-notebook': CharacterNotebookElement;
  }
}
