import cytoscape from 'cytoscape';
import './graph.css';
import type {
  Core,
  ElementDefinition,
  StylesheetCSS,
  LayoutOptions,
  NodeSingular,
  EdgeSingular,
} from 'cytoscape';
import {
  DEFAULT_OPTIONS,
  GROUP_COLORS,
  RELATION_COLORS,
  parseGraphDocument,
  parseGraphOptions,
  getAllActiveRelationsByChapter,
  getAllVisibleCharactersByChapter,
  getAllGroupPositions,
} from './model';
import type { GraphDocument, GraphOptions, LayoutName } from './model';
import {
  findCoreCharacterId,
  getAllSemanticPositions,
  getAllCurveRoutes,
  sampleCurveRoute,
} from './semantic-layout';

export type Selection = { kind: 'character' | 'relation'; id: string } | null;

export class CharacterGraph {
  readonly core: Core;
  document: GraphDocument;
  options: GraphOptions;
  chapter: number;
  selection: Selection = null;
  private host: HTMLElement;
  private onSelection: (selection: Selection) => void;
  private resizeObserver: ResizeObserver;
  private pendingFit: ReturnType<typeof setTimeout> | undefined;

  constructor(
    host: HTMLElement,
    document: GraphDocument,
    options: Partial<GraphOptions> = {},
    onSelection: (selection: Selection) => void = () => {},
  ) {
    this.host = host;
    this.host.dataset.characterGraph = '';
    this.document = parseGraphDocument(document);
    this.options = parseGraphOptions({ ...DEFAULT_OPTIONS, ...options });
    this.chapter = this.document.maxChapter;
    this.onSelection = onSelection;
    this.core = cytoscape({
      container: host,
      elements: [],
      minZoom: 0.12,
      maxZoom: 3.5,
      boxSelectionEnabled: false,
      selectionType: 'single',
      layout: { name: 'preset' },
      style: [],
    });
    this.core.on('tap', 'node', (event) => this.selectCharacterById(event.target.id()));
    this.core.on('tap', 'edge', (event) => this.selectRelationById(event.target.id()));
    this.core.on('tap', (event) => {
      if (event.target === this.core) this.clearSelection();
    });
    this.core.on('zoom', () => {
      this.core.style().update();
    });
    this.core.on('dragfree', 'node', () => this.updateAllCurveRoutes());
    this.resizeObserver = new ResizeObserver(() => {
      this.core.resize();
      this.fit();
    });
    this.resizeObserver.observe(host);
    this.loadData(document);
  }

  loadData(document: GraphDocument): void {
    this.replaceGraphDocument(document, false);
  }

  updateDataPreservingPositions(document: GraphDocument): void {
    this.replaceGraphDocument(document, true);
  }

  private replaceGraphDocument(document: GraphDocument, preservePositions: boolean): void {
    const parsed = parseGraphDocument(document);
    clearTimeout(this.pendingFit);
    this.core.stop(true, false);
    this.core.nodes().stop(true, false);
    const previousSelection = this.selection;
    const characterIds = new Set(parsed.characters.map((person) => person.id));
    const relationIds = new Set(parsed.relations.map((relation) => relation.id));
    if (!preservePositions) this.core.elements().remove();
    else {
      this.core
        .edges()
        .filter((edge) => !relationIds.has(edge.id()))
        .remove();
      this.core
        .nodes()
        .filter((node) => !characterIds.has(node.id()))
        .remove();
    }
    this.document = parsed;
    this.chapter = parsed.maxChapter;
    this.selection =
      preservePositions &&
      previousSelection &&
      (characterIds.has(previousSelection.id) || relationIds.has(previousSelection.id))
        ? previousSelection
        : null;
    const groups = [...new Set(parsed.characters.map((person) => person.group))];
    const positions = getAllSemanticPositions(parsed);
    const elements: ElementDefinition[] = [
      ...parsed.characters.map((person) => ({
        group: 'nodes' as const,
        data: {
          ...person,
          isCore: person.id === findCoreCharacterId(parsed),
          color: GROUP_COLORS[groups.indexOf(person.group) % GROUP_COLORS.length],
        },
        position: positions.get(person.id),
      })),
      ...parsed.relations.map((relation) => ({
        group: 'edges' as const,
        data: { ...relation, color: RELATION_COLORS[relation.type] ?? this.options.edgeColor },
      })),
    ];
    const addedIds: string[] = [];
    this.core.batch(() => {
      for (const element of elements) {
        const existing = this.core.getElementById(element.data.id!);
        if (existing.length) existing.data(element.data);
        else {
          this.core.add(element);
          addedIds.push(element.data.id!);
        }
      }
    });
    this.updateAllCurveRoutes();
    this.applyAppearanceOptions(parsed.appearance ?? {});
    this.setChapter(parsed.maxChapter);
    if (
      preservePositions &&
      this.options.transition !== 'none' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const added = this.core.elements().filter((element) => addedIds.includes(element.id()));
      added.addClass('entering');
      requestAnimationFrame(() => {
        if (!this.core.destroyed()) added.removeClass('entering');
      });
    }
    this.fit(preservePositions);
  }

  private updateAllCurveRoutes(): void {
    const positions = new Map(
      this.core.nodes().map((node) => [node.id(), { ...node.position() }] as const),
    );
    const routes = getAllCurveRoutes(this.document, positions);
    this.core.batch(() => {
      this.core.edges().forEach((edge) => {
        const route = routes.get(edge.id())!;
        edge.data('routeDistance', route.distance);
        edge.data('routeDistances', route.distances.join(' '));
        edge.data('routeWeights', route.weights.join(' '));
        edge.data('routeObstacleCount', route.obstacleCount);
        const coreId = findCoreCharacterId(this.document);
        const ratio =
          edge.data('source') === coreId ? 0.68 : edge.data('target') === coreId ? 0.32 : 0.5;
        const points = sampleCurveRoute(
          positions.get(edge.data('source'))!,
          positions.get(edge.data('target'))!,
          route.distances,
          route.weights,
          100,
        );
        const middle = points[Math.floor((points.length - 1) / 2)],
          label = points[Math.round(ratio * (points.length - 1))];
        edge.data('labelOffsetX', label.x - middle.x);
        edge.data('labelOffsetY', label.y - middle.y);
      });
    });
  }

  applyAppearanceOptions(options: Partial<GraphOptions> = {}): void {
    this.options = parseGraphOptions({ ...this.options, ...options });
    const settings = this.options;
    this.host.style.backgroundColor = settings.background;
    this.host.dataset.pattern = settings.pattern;
    this.host.style.setProperty(
      '--background-image',
      settings.backgroundImage
        ? `url("${settings.backgroundImage.replace(/["\\\n\r]/g, '')}")`
        : 'none',
    );
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion || settings.transition === 'none' ? 0 : settings.duration;
    const channels = settings.background
      .slice(1)
      .match(/.{2}/g)!
      .map((value) => parseInt(value, 16));
    const isLight = channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114 > 165;
    const textColor = isLight ? '#243748' : '#f1f6fa';
    const styles: StylesheetCSS[] = [
      {
        selector: 'node',
        css: {
          width: 48,
          height: 48,
          label: 'data(name)',
          'background-color': isLight ? '#ffffff' : '#203d51',
          'border-color': 'data(color)',
          'border-width': 2,
          color: textColor,
          'font-size': 15,
          'font-family': 'Microsoft YaHei, sans-serif',
          'text-valign': 'bottom',
          'text-margin-y': 10,
          'text-background-color': settings.background,
          'text-background-opacity': 0.9,
          'text-background-padding': '3px',
          'min-zoomed-font-size': 9,
          'overlay-padding': '7px',
          'transition-property': 'opacity, background-color, border-width',
          'transition-duration': duration,
        },
      },
      {
        selector: 'edge',
        css: {
          width: settings.edgeWidth,
          'line-color': (edge) =>
            settings.unifiedEdgeColor
              ? settings.edgeColor
              : this.getRelationColor(edge.data('color'), isLight),
          'target-arrow-color': (edge) =>
            settings.unifiedEdgeColor
              ? settings.edgeColor
              : this.getRelationColor(edge.data('color'), isLight),
          'target-arrow-shape': 'none',
          'arrow-scale': 0.8,
          'line-style': settings.edgeLine,
          'curve-style': settings.edgeShape === 'bezier' ? 'unbundled-bezier' : settings.edgeShape,
          'control-point-step-size': 65,
          'control-point-distances': 'data(routeDistances)',
          'control-point-weights': 'data(routeWeights)',
          'edge-distances': 'node-position',
          label: settings.labels === 'all' ? 'data(label)' : '',
          color: textColor,
          'font-size': 12,
          'text-background-color': settings.background,
          'text-background-opacity': 0.95,
          'text-background-padding': '4px',
          'text-rotation': 'none',
          'text-margin-x': (edge: EdgeSingular) => edge.data('labelOffsetX'),
          'text-margin-y': (edge: EdgeSingular) => edge.data('labelOffsetY'),
          'min-zoomed-font-size': 9,
          'transition-property':
            settings.transition === 'fade' ? 'opacity' : 'opacity, line-color, width',
          'transition-duration': duration,
          'overlay-padding': '8px',
        },
      },
      {
        selector: 'edge[?directed]',
        css: { 'target-arrow-shape': settings.arrows ? 'triangle' : 'none' },
      },
      { selector: '.dimmed', css: { opacity: 0.13, label: '' } },
      { selector: 'node.dimmed', css: { opacity: 0.5, label: 'data(name)' } },
      {
        selector: 'node.focused',
        css: {
          'background-color': 'data(color)',
          'border-width': 5,
          'border-color': '#ffffff',
          'font-weight': 'bold',
          opacity: 1,
          'font-size': (node: NodeSingular) => Math.max(15, 12 / node.cy().zoom()),
          'min-zoomed-font-size': 0,
        },
      },
      {
        selector: 'edge.related',
        css: {
          width: settings.edgeWidth + 1.1,
          label: (edge: EdgeSingular) =>
            settings.labels === 'none' || (settings.labels === 'related' && edge.cy().zoom() < 0.45)
              ? ''
              : edge.data('label'),
          opacity: 1,
          'font-size': (edge: EdgeSingular) => Math.max(12, 10 / edge.cy().zoom()),
          'min-zoomed-font-size': 0,
        },
      },
      {
        selector: 'edge.focused',
        css: {
          width: settings.edgeWidth + 2,
          label: settings.labels === 'none' ? '' : 'data(label)',
          opacity: 1,
        },
      },
      {
        selector: 'node.neighbor',
        css: {
          label: (node: NodeSingular) => (node.cy().zoom() < 0.32 ? '' : node.data('name')),
          'border-width': 3,
          opacity: 1,
          'font-size': (node: NodeSingular) => Math.max(15, 11 / node.cy().zoom()),
          'min-zoomed-font-size': 0,
        },
      },
      {
        selector: 'node[?isCore]',
        css: {
          label: 'data(name)',
          'font-size': (node: NodeSingular) => Math.max(15, 12 / node.cy().zoom()),
          'min-zoomed-font-size': 0,
        },
      },
      { selector: '.unrevealed', css: { display: 'none' } },
      { selector: '.entering', css: { opacity: 0 } },
    ];
    this.core.style(styles);
    this.updateSelectionStyles();
  }

  private getRelationColor(color: string, isLight: boolean): string {
    if (!isLight) return color;
    const values = color
      .slice(1)
      .match(/.{2}/g)!
      .map((value) =>
        Math.round(parseInt(value, 16) * 0.6)
          .toString(16)
          .padStart(2, '0'),
      );
    return `#${values.join('')}`;
  }

  setChapter(chapter: number): void {
    if (!Number.isFinite(chapter)) return;
    this.chapter = Math.max(1, Math.min(this.document.maxChapter, Math.round(chapter)));
    const characters = new Set(
      getAllVisibleCharactersByChapter(this.document, this.chapter).map((person) => person.id),
    );
    const relations = new Set(
      getAllActiveRelationsByChapter(this.document, this.chapter).map((relation) => relation.id),
    );
    this.core.batch(() => {
      this.core.nodes().forEach((node) => {
        node.toggleClass('unrevealed', !characters.has(node.id()));
      });
      this.core.edges().forEach((edge) => {
        edge.toggleClass('unrevealed', !relations.has(edge.id()));
      });
    });
    if (this.selection && !characters.has(this.selection.id) && !relations.has(this.selection.id)) {
      this.clearSelection();
    } else this.updateSelectionStyles();
  }

  selectCharacterById(id: string): void {
    const node = this.core.getElementById(id);
    if (!node.isNode() || node.hasClass('unrevealed')) return;
    this.selection = { kind: 'character', id };
    this.updateSelectionStyles();
    this.onSelection(this.selection);
  }

  selectRelationById(id: string): void {
    const edge = this.core.getElementById(id);
    if (!edge.isEdge() || edge.hasClass('unrevealed')) return;
    this.selection = { kind: 'relation', id };
    this.updateSelectionStyles();
    this.onSelection(this.selection);
  }

  clearSelection(): void {
    this.selection = null;
    this.updateSelectionStyles();
    this.onSelection(null);
  }

  private updateSelectionStyles(): void {
    this.core.batch(() => {
      this.core.elements().removeClass('dimmed focused related neighbor');
      if (!this.selection) return;
      const element = this.core.getElementById(this.selection.id);
      const edge = this.core.edges().filter((item) => item.id() === this.selection!.id);
      const related =
        this.selection.kind === 'character'
          ? element.closedNeighborhood()
          : edge.connectedNodes().union(edge);
      this.core.elements().not(related).addClass('dimmed');
      element.addClass('focused');
      related.nodes().not(element).addClass('neighbor');
      related.edges().addClass('related');
    });
  }

  applyLayout(name: LayoutName): void {
    clearTimeout(this.pendingFit);
    this.core.nodes().stop(true, false);
    const visible = this.core.elements().not('.unrevealed');
    if (name === 'groups' || name === 'semantic') {
      const cleanDocument = {
        ...this.document,
        characters: this.document.characters.map((person) => ({ ...person, position: undefined })),
      };
      const positions =
        name === 'semantic'
          ? getAllSemanticPositions(cleanDocument, false)
          : getAllGroupPositions(cleanDocument);
      const animate =
        this.options.transition !== 'none' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.core.nodes().forEach((node) => {
        const position = positions.get(node.id())!;
        node.stop(true, false);
        if (animate) node.animate({ position }, { duration: this.options.duration });
        else node.position(position);
      });
      this.pendingFit = setTimeout(
        () => {
          this.updateAllCurveRoutes();
          this.fit();
        },
        animate ? this.options.duration + 30 : 0,
      );
      return;
    }
    const options: LayoutOptions =
      name === 'circle'
        ? { name: 'circle', padding: 50, spacingFactor: 1.6, animate: false }
        : {
            name: 'cose',
            padding: 60,
            animate: false,
            randomize: false,
            nodeRepulsion: () => 16000,
            idealEdgeLength: () => 135,
            componentSpacing: 130,
            nodeDimensionsIncludeLabels: true,
          };
    visible.layout(options).run();
    this.updateAllCurveRoutes();
    this.fit();
  }

  fit(animate = false): void {
    const visible = this.core.elements().not('.unrevealed');
    const core = this.core.getElementById(findCoreCharacterId(this.document));
    const center = core.position();
    const bounds = visible.boundingBox();
    const radiusX = Math.max(180, Math.abs(bounds.x1 - center.x), Math.abs(bounds.x2 - center.x));
    const radiusY = Math.max(150, Math.abs(bounds.y1 - center.y), Math.abs(bounds.y2 - center.y));
    const padding = this.host.clientWidth < 600 ? 28 : 48;
    const zoom = Math.max(
      this.core.minZoom(),
      Math.min(
        1.4,
        (this.host.clientWidth - padding * 2) / (radiusX * 2),
        (this.host.clientHeight - padding * 2) / (radiusY * 2),
      ),
    );
    const pan = {
      x: this.host.clientWidth / 2 - center.x * zoom,
      y: this.host.clientHeight / 2 - center.y * zoom,
    };
    this.core.stop(true, false);
    if (
      animate &&
      this.options.transition !== 'none' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.core.animate({ zoom, pan }, { duration: this.options.duration });
    } else this.core.viewport({ zoom, pan });
  }
  zoomBy(factor: number): void {
    this.core.zoom({
      level: this.core.zoom() * factor,
      renderedPosition: { x: this.host.clientWidth / 2, y: this.host.clientHeight / 2 },
    });
  }

  exportGraphDocument(): GraphDocument {
    return {
      ...this.document,
      appearance: { ...this.options },
      characters: this.document.characters.map((person) => ({
        ...person,
        position: { ...this.core.getElementById(person.id).position() },
      })),
    };
  }

  dispose(): void {
    clearTimeout(this.pendingFit);
    this.resizeObserver.disconnect();
    this.core.destroy();
  }
}
