import cytoscape from 'cytoscape';
import { getAllCrossGroupChannelRoutes, shouldDisplayCrossGroupRelation } from './group-channels';
import { getAllGroupRegions } from './group-regions';
import { getAllNonOverlappingLabelPositions, getPointAlongPolyline } from './edge-labels';
import { getAllStructuredPositions, getAllRootedBranches } from './structured-layout';
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
  private groupLayer: SVGSVGElement;
  private groupFrame?: number;
  private layoutName: LayoutName = 'semantic';
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
    this.groupLayer = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.groupLayer.setAttribute('data-group-layer', '');
    this.groupLayer.setAttribute('aria-hidden', 'true');
    this.host.append(this.groupLayer);
    this.core.on('pan zoom resize position', () => this.scheduleAllGroupBackgroundUpdates());
    this.core.on('tap', 'node', (event) => this.selectCharacterById(event.target.id()));
    this.core.on('tap', 'edge', (event) => this.selectRelationById(event.target.id()));
    this.core.on('tap', (event) => {
      if (event.target === this.core) this.clearSelection();
    });
    this.core.on('zoom', () => {
      this.updateAllRelationLabelPositions();
      this.core.style().update();
    });
    this.core.on('dragfree', 'node', () => {
      this.updateAllCurveRoutes();
      this.updateAllRelationLabelPositions();
    });
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
    this.core.edges().removeClass('layout-moving');
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
          color:
            parsed.groups?.find((group) => group.name === person.group)?.color ??
            GROUP_COLORS[groups.indexOf(person.group) % GROUP_COLORS.length],
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
    const strength =
      this.options.edgeShape === 'soft-bezier' ? 0.65 : this.options.edgeShape === 'arc' ? 1.6 : 1;
    const radius =
      this.options.nodeSize * (this.options.nodeShape === 'round-rectangle' ? 0.95 : 0.5) + 10;
    const routes = getAllCurveRoutes(
      this.document,
      positions,
      this.options.edgeCurvature * strength,
      radius,
    );
    const nodes = this.core
      .nodes()
      .not('.unrevealed')
      .map((item) => {
        const node = item as NodeSingular;
        return {
          id: node.id(),
          group: String(node.data('group')),
          ...node.position(),
          width: node.width(),
          height: node.height() + 24,
        };
      });
    const regions = getAllGroupRegions(
      this.document,
      nodes,
      this.options.groupPadding,
      GROUP_COLORS,
    );
    const channels =
      this.options.crossGroupRouting === 'channels'
        ? getAllCrossGroupChannelRoutes(this.document, nodes, regions)
        : new Map();
    this.core.batch(() => {
      this.core.edges().forEach((edge) => {
        const route = routes.get(edge.id())!;
        const channel = channels.get(edge.id());
        edge.data('channelRoute', !!channel);
        edge.data('channelDistances', channel?.distances.join(' ') ?? '0');
        edge.data('channelWeights', channel?.weights.join(' ') ?? '0.5');
        edge.data('routeDistance', route.distance);
        edge.data('routeDistances', route.distances.join(' '));
        edge.data('routeWeights', route.weights.join(' '));
        edge.data('routeObstacleCount', route.obstacleCount);
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
          shape: settings.nodeShape,
          width:
            settings.nodeShape === 'round-rectangle' ? settings.nodeSize * 1.9 : settings.nodeSize,
          height: settings.nodeSize,
          label: (node: NodeSingular) => this.getCharacterLabel(node),
          'background-color': isLight ? '#ffffff' : '#203d51',
          'border-color': 'data(color)',
          'border-width': 2,
          color: textColor,
          'font-size': (node: NodeSingular) =>
            settings.showGroupBackground ? Math.max(15, 10 / node.cy().zoom()) : 15,
          'font-family': 'Microsoft YaHei, sans-serif',
          'text-valign': settings.nodeShape === 'round-rectangle' ? 'center' : 'bottom',
          'text-margin-y': settings.nodeShape === 'round-rectangle' ? 0 : 10,
          'text-wrap': 'wrap',
          'text-max-width': `${settings.nodeShape === 'round-rectangle' ? settings.nodeSize * 1.9 - 16 : 160}px`,
          'text-background-color': settings.background,
          'text-background-opacity': 0.9,
          'text-background-padding': '3px',
          'min-zoomed-font-size': settings.showGroupBackground ? 0 : 9,
          'overlay-padding': '7px',
          'transition-property': 'opacity, background-color, border-width',
          'transition-duration': duration,
        },
      },
      {
        selector: 'edge',
        css: {
          opacity: (edge: EdgeSingular) =>
            settings.showGroupBackground &&
            edge.source().data('group') !== edge.target().data('group')
              ? 0.32
              : 1,
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
          'curve-style': ['bezier', 'soft-bezier', 'arc'].includes(settings.edgeShape)
            ? 'unbundled-bezier'
            : ['horizontal-taxi', 'vertical-taxi'].includes(settings.edgeShape)
              ? 'round-taxi'
              : settings.edgeShape === 'straight'
                ? 'straight'
                : settings.edgeShape === 'round-segments'
                  ? 'round-segments'
                  : 'round-taxi',
          'line-cap': 'round',
          'taxi-direction':
            settings.edgeShape === 'horizontal-taxi'
              ? 'horizontal'
              : settings.edgeShape === 'vertical-taxi'
                ? 'vertical'
                : 'auto',
          'taxi-turn': (edge: EdgeSingular) =>
            `${Math.max(20, Math.min(80, 50 + edge.data('routeDistance') / 12))}%`,
          'taxi-radius': settings.edgeCornerRadius,
          'taxi-turn-min-distance': 24,
          'segment-distances': 'data(routeDistances)',
          'segment-weights': 'data(routeWeights)',
          'segment-radii': [settings.edgeCornerRadius],
          'control-point-step-size': 65,
          'control-point-distances': 'data(routeDistances)',
          'control-point-weights': 'data(routeWeights)',
          'edge-distances': 'node-position',
          label: settings.labels === 'all' ? 'data(label)' : '',
          color: textColor,
          'font-size': (edge: EdgeSingular) =>
            settings.labels === 'all'
              ? Math.max(settings.labelFontSize, 10 / edge.cy().zoom())
              : settings.labelFontSize,
          'text-background-color': settings.background,
          'text-background-opacity': settings.labelBackground === 'none' ? 0 : 0.96,
          'text-background-shape':
            settings.labelBackground === 'pill' ? 'roundrectangle' : 'rectangle',
          'text-background-padding': '5px',
          'text-border-width': settings.labelBackground === 'pill' ? 0.6 : 0,
          'text-border-color': isLight ? '#b3c4d0' : '#476477',
          'text-border-opacity': 0.6,
          'text-wrap': 'wrap',
          'text-overflow-wrap': 'anywhere',
          'text-max-width': `${settings.labelMaxWidth}px`,
          'text-rotation': settings.labelDirection === 'along-edge' ? 'autorotate' : 'none',
          'text-margin-x': (edge: EdgeSingular) => Number(edge.data('labelOffsetX')) || 0,
          'text-margin-y': (edge: EdgeSingular) => Number(edge.data('labelOffsetY')) || 0,
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
      {
        selector: 'edge[?channelRoute]',
        css: {
          'curve-style': 'round-segments',
          'segment-distances': 'data(channelDistances)',
          'segment-weights': 'data(channelWeights)',
          'segment-radii': [10],
        },
      },
      { selector: 'edge.cross-branch', css: { opacity: 0.2, 'line-style': 'dotted' } },
      { selector: '.dimmed', css: { opacity: 0.13, label: '' } },
      {
        selector: 'edge.dimmed',
        css: {
          opacity: settings.labels === 'all' ? 0.55 : 0.13,
          label: settings.labels === 'all' ? 'data(label)' : '',
        },
      },
      {
        selector: 'node.dimmed',
        css: { opacity: 0.5, label: (node: NodeSingular) => this.getCharacterLabel(node) },
      },
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
            settings.labels === 'none' ||
            settings.labels === 'focused' ||
            (settings.labels === 'related' && edge.cy().zoom() < 0.45)
              ? ''
              : edge.data('label'),
          opacity: 1,
          'font-size': (edge: EdgeSingular) =>
            Math.max(settings.labelFontSize, settings.labelFontSize / edge.cy().zoom()),
          'min-zoomed-font-size': 0,
        },
      },
      {
        selector: 'edge.focused',
        css: {
          width: settings.edgeWidth + 2,
          label: settings.labels === 'none' ? '' : 'data(label)',
          'font-size': (edge: EdgeSingular) =>
            Math.max(settings.labelFontSize, settings.labelFontSize / edge.cy().zoom()),
          'min-zoomed-font-size': 0,
          opacity: 1,
        },
      },
      {
        selector: 'node.neighbor',
        css: {
          label: (node: NodeSingular) =>
            !settings.showGroupBackground && node.cy().zoom() < 0.32
              ? ''
              : this.getCharacterLabel(node),
          'border-width': 3,
          opacity: 1,
          'font-size': (node: NodeSingular) => Math.max(15, 11 / node.cy().zoom()),
          'min-zoomed-font-size': 0,
        },
      },
      {
        selector: 'node[?isCore]',
        css: {
          label: (node: NodeSingular) => this.getCharacterLabel(node),
          'font-size': (node: NodeSingular) => Math.max(15, 12 / node.cy().zoom()),
          'min-zoomed-font-size': 0,
        },
      },
      { selector: 'edge.cross-group-hidden', css: { display: 'none' } },
      { selector: '.unrevealed', css: { display: 'none' } },
      { selector: 'edge.layout-moving', css: { display: 'none' } },
      { selector: '.entering', css: { opacity: 0 } },
    ];
    this.core.style(styles);
    this.updateAllCurveRoutes();
    this.updateSelectionStyles();
    this.updateAllGroupBackgrounds();
  }

  private updateAllRelationLabelPositions(): void {
    const settings = this.options;
    const zoom = this.core.zoom();
    const edges = this.core
      .edges()
      .filter(
        (edge) =>
          !edge.hasClass('cross-group-hidden') &&
          !edge.hasClass('unrevealed') &&
          !edge.hasClass('layout-moving') &&
          (settings.labels === 'all' ||
            (settings.labels === 'related' && edge.hasClass('related') && zoom >= 0.45) ||
            (settings.labels !== 'none' && edge.hasClass('focused'))),
      );
    const inputs = edges.map((item) => {
      const edge = item as EdgeSingular;
      const a = edge.source().position(),
        b = edge.target().position();
      const renderedMiddle = edge.midpoint();
      const middle =
        renderedMiddle && Number.isFinite(renderedMiddle.x) && Number.isFinite(renderedMiddle.y)
          ? renderedMiddle
          : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const size = edge.hasClass('related')
        ? Math.max(settings.labelFontSize, settings.labelFontSize / zoom)
        : settings.labels === 'all'
          ? Math.max(settings.labelFontSize, 10 / zoom)
          : settings.labelFontSize;
      const textWidth = Math.min(settings.labelMaxWidth, String(edge.data('label')).length * size);
      const height =
        Math.ceil((String(edge.data('label')).length * size) / settings.labelMaxWidth) *
          size *
          1.3 +
        12;
      const base =
        settings.labelPosition === 'source' ? 0.3 : settings.labelPosition === 'target' ? 0.7 : 0.5;
      const coreId = findCoreCharacterId(this.document);
      const preferred =
        edge.source().id() === coreId ? 0.68 : edge.target().id() === coreId ? 0.32 : 0.5;
      const ratios =
        settings.labelPosition === 'auto' ? [preferred, 0.5, 0.35, 0.65, 0.25, 0.75] : [base];
      const curved =
        !edge.data('channelRoute') && ['bezier', 'soft-bezier', 'arc'].includes(settings.edgeShape);
      const points = curved
        ? sampleCurveRoute(
            a,
            b,
            String(edge.data('routeDistances')).split(' ').map(Number),
            String(edge.data('routeWeights')).split(' ').map(Number),
            60,
          )
        : [];
      const segments = edge.segmentPoints();
      const polyline = [
        edge.sourceEndpoint() ?? a,
        ...(segments ?? [middle]),
        edge.targetEndpoint() ?? b,
      ].filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));
      const candidates = ratios.flatMap((ratio) => {
        const point = curved
          ? points[Math.round((points.length - 1) * ratio)]
          : ratio === 0.5
            ? middle
            : getPointAlongPolyline(polyline, ratio);
        const shifts = settings.avoidLabelOverlap ? [0, -18, 18, -36, 36] : [0];
        return shifts.map((shift) => ({ x: point.x, y: point.y + settings.labelOffset + shift }));
      });
      return { id: edge.id(), width: textWidth + 14, height, candidates };
    });
    const obstacles = this.core
      .nodes()
      .not('.unrevealed')
      .map((item) => {
        const node = item as NodeSingular;
        return {
          x: node.position('x'),
          y: node.position('y'),
          width: node.width() + 16,
          height: node.height() + 16,
        };
      });
    const placements = getAllNonOverlappingLabelPositions(
      inputs,
      settings.avoidLabelOverlap ? obstacles : [],
    );
    this.core.batch(() =>
      this.core.edges().forEach((edge) => {
        if (
          edge.hasClass('cross-group-hidden') ||
          edge.hasClass('layout-moving') ||
          edge.hasClass('unrevealed')
        )
          return;
        const middle = edge.midpoint() ?? { x: 0, y: 0 },
          point = placements.get(edge.id());
        edge.data('labelOffsetX', point ? point.x - middle.x : 0);
        edge.data('labelOffsetY', point ? point.y - middle.y : settings.labelOffset);
      }),
    );
  }

  private scheduleAllGroupBackgroundUpdates(): void {
    if (this.groupFrame !== undefined) return;
    this.groupFrame = requestAnimationFrame(() => {
      this.groupFrame = undefined;
      this.updateAllGroupBackgrounds();
    });
  }
  private updateAllGroupBackgrounds(): void {
    if (!this.groupLayer || this.core.destroyed()) return;
    this.groupLayer.replaceChildren();
    this.groupLayer.style.display = this.options.showGroupBackground ? 'block' : 'none';
    if (!this.options.showGroupBackground) return;
    const nodes = this.core
      .nodes()
      .not('.unrevealed')
      .map((item) => {
        const node = item as NodeSingular;
        return {
          id: node.id(),
          group: String(node.data('group')),
          x: node.position('x'),
          y: node.position('y'),
          width: node.width(),
          height: node.height() + 24,
        };
      });
    const regions = getAllGroupRegions(
      this.document,
      nodes,
      this.options.groupPadding,
      GROUP_COLORS,
    );
    const layer = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const pan = this.core.pan();
    layer.setAttribute('transform', `translate(${pan.x},${pan.y}) scale(${this.core.zoom()})`);
    for (const region of regions) {
      const group = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('data-character-group', region.name);
      const rect = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [key, value] of Object.entries({
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        rx: 18,
        fill: region.color,
        'fill-opacity': this.options.groupOpacity,
        stroke: region.color,
        'stroke-opacity': 0.48,
        'stroke-width': 1.3,
      }))
        rect.setAttribute(key, String(value));
      if (this.options.groupBorder === 'dashed') rect.setAttribute('stroke-dasharray', '7 5');
      group.append(rect);
      const title = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.setAttribute('x', String(region.x + 20));
      title.setAttribute('y', String(region.y + Math.max(28, 18 / this.core.zoom())));
      title.setAttribute('fill', region.color);
      title.setAttribute('font-size', String(Math.max(18, 12 / this.core.zoom())));
      title.setAttribute('font-weight', '600');
      title.textContent = `${region.label} · ${region.count} 人`;
      group.append(title);
      if (region.description && this.core.zoom() >= 0.55) {
        const description = globalThis.document.createElementNS(
          'http://www.w3.org/2000/svg',
          'text',
        );
        description.setAttribute('x', String(region.x + 20));
        description.setAttribute('y', String(region.y + 49));
        description.setAttribute('fill', region.color);
        description.setAttribute('font-size', '12');
        description.setAttribute('opacity', '0.85');
        description.textContent = region.description.slice(0, 30);
        group.append(description);
      }
      layer.append(group);
    }
    this.groupLayer.append(layer);
  }

  private getCharacterLabel(node: NodeSingular): string {
    const name = String(node.data('name'));
    if (this.options.nodeContent === 'identity') {
      const attributes = node.data('attributes') ?? {};
      const subtitle =
        attributes['身份'] ??
        attributes['职责'] ??
        (node.data('aliases') ?? []).find((alias: string) => alias !== name) ??
        '';
      return subtitle ? `${name}\n${String(subtitle).slice(0, 16)}` : name;
    }
    if (this.options.nodeContent === 'group') return `${name}\n${node.data('group')}`;
    if (this.options.nodeContent === 'description') {
      const text = String(node.data('description') ?? '');
      return `${name}\n${text.length > 18 ? text.slice(0, 18) + '…' : text}`;
    }
    return name;
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
    this.updateAllCurveRoutes();
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
      this.core.edges().forEach((edge) => {
        const cross = edge.source().data('group') !== edge.target().data('group');
        edge.toggleClass(
          'cross-group-hidden',
          cross &&
            !shouldDisplayCrossGroupRelation(
              this.options.crossGroupVisibility,
              { id: edge.id(), source: edge.source().id(), target: edge.target().id() },
              this.selection,
            ),
        );
      });
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
    this.updateAllRelationLabelPositions();
  }

  applyLayout(name: LayoutName): void {
    this.layoutName = name;
    clearTimeout(this.pendingFit);
    this.core.nodes().stop(true, false);
    const visible = this.core.elements().not('.unrevealed');
    this.core.edges().removeClass('cross-branch layout-moving');
    if (name !== 'circle' && name !== 'force') {
      const cleanDocument = {
        ...this.document,
        characters: this.document.characters.map((person) => ({ ...person, position: undefined })),
      };
      const positions =
        name === 'semantic'
          ? getAllSemanticPositions(cleanDocument, false)
          : name === 'groups'
            ? getAllGroupPositions(cleanDocument)
            : getAllStructuredPositions(cleanDocument, name);
      if (name === 'mindmap' || name === 'tree' || name === 'horizontal-tree') {
        const { parents } = getAllRootedBranches(cleanDocument);
        const pairs = new Set<string>();
        this.core.edges().forEach((edge) => {
          const source = edge.source().id(),
            target = edge.target().id();
          const pair = [source, target].sort().join('|');
          const branch =
            (parents.get(source) === target || parents.get(target) === source) && !pairs.has(pair);
          edge.toggleClass('cross-branch', !branch);
          if (branch) pairs.add(pair);
        });
      }
      const animate =
        this.options.transition !== 'none' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const finishLayout = () => {
        if (this.core.destroyed()) return;
        this.updateAllCurveRoutes();
        this.core.edges().removeClass('layout-moving');
        this.updateAllRelationLabelPositions();
        this.fit();
      };
      const nodes = this.core.nodes();
      let remaining = nodes.length;
      if (animate) this.core.edges().addClass('layout-moving');
      nodes.forEach((node) => {
        const position = positions.get(node.id())!;
        node.stop(true, false);
        if (animate)
          node.animate(
            { position },
            {
              duration: this.options.duration,
              complete: () => {
                remaining--;
                if (remaining === 0) finishLayout();
              },
            },
          );
        else node.position(position);
      });
      if (!animate) finishLayout();
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
    this.updateAllRelationLabelPositions();
    this.fit();
  }

  fit(animate = false): void {
    const visible = this.core.elements().not('.unrevealed');
    const core = this.core.getElementById(findCoreCharacterId(this.document));
    let center = core.position();
    const bounds =
      this.layoutName === 'groups'
        ? visible.nodes().boundingBox({ includeLabels: false, includeOverlays: false })
        : visible.boundingBox();
    if (this.layoutName === 'groups')
      center = { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 };
    if (this.options.showGroupBackground) {
      bounds.y1 -= this.options.groupPadding + 60;
      bounds.y2 += this.options.groupPadding;
      bounds.x1 -= this.options.groupPadding;
      bounds.x2 += this.options.groupPadding;
    }
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
    if (this.groupFrame !== undefined) cancelAnimationFrame(this.groupFrame);
    this.groupLayer.remove();
    this.core.destroy();
  }
}
