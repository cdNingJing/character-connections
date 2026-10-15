import { CharacterGraph } from './character-graph';
import type { Selection } from './character-graph';
import { parseGraphDocument, parseGraphOptions, LAYOUT_NAMES } from './model';
import type { GraphDocument, GraphOptions, LayoutName } from './model';

export interface CharacterGraphProps {
  data: GraphDocument;
  layout?: LayoutName;
  appearance?: Partial<GraphOptions>;
  chapter?: number;
  preservePositions?: boolean;
  onSelectionChange?: (selection: Selection) => void;
}
function validateComponentProps(props: CharacterGraphProps): CharacterGraphProps {
  if (props.layout !== undefined && !LAYOUT_NAMES.includes(props.layout))
    throw new Error('不支持的布局方式');
  if (props.chapter !== undefined && (!Number.isFinite(props.chapter) || props.chapter < 1))
    throw new Error('chapter 必须是大于 0 的数字');
  return {
    ...props,
    data: parseGraphDocument(props.data),
    appearance: parseGraphOptions(props.appearance ?? props.data.appearance ?? {}),
  };
}
/** Framework-independent component. The caller owns the host element and its height. */
export class CharacterGraphComponent {
  readonly graph: CharacterGraph;
  private props: CharacterGraphProps;
  private destroyed = false;
  constructor(host: HTMLElement, props: CharacterGraphProps) {
    this.props = validateComponentProps(props);
    this.graph = new CharacterGraph(host, this.props.data, this.props.appearance, (selection) =>
      this.props.onSelectionChange?.(selection),
    );
    this.graph.applyAppearanceOptions(this.props.appearance);
    if (props.layout) this.graph.applyLayout(props.layout);
    if (props.chapter !== undefined) this.graph.setChapter(props.chapter);
  }
  update(props: Partial<CharacterGraphProps>): void {
    if (this.destroyed) throw new Error('组件已销毁，请重新创建');
    // Validate the complete update before changing the current graph.
    const next = validateComponentProps({
      ...this.props,
      ...props,
      appearance: { ...(props.data?.appearance ?? this.props.appearance), ...props.appearance },
    });
    this.props = next;
    if (props.data) {
      if (next.preservePositions) this.graph.updateDataPreservingPositions(next.data);
      else this.graph.loadData(next.data);
    }
    if (props.data || props.appearance) this.graph.applyAppearanceOptions(next.appearance);
    if (props.layout !== undefined || (props.data && !next.preservePositions && next.layout))
      this.graph.applyLayout(next.layout ?? 'semantic');
    if (next.chapter !== undefined) this.graph.setChapter(next.chapter);
  }
  fit(): void {
    this.graph.fit();
  }
  exportData(): GraphDocument {
    return this.graph.exportGraphDocument();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.graph.dispose();
  }
}
export function createCharacterGraph(
  host: HTMLElement,
  props: CharacterGraphProps,
): CharacterGraphComponent {
  return new CharacterGraphComponent(host, props);
}
