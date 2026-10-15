import { DEFAULT_OPTIONS } from '../lib/model.ts';
import type { GraphOptions, LayoutName } from '../lib/model';
export type IntegrationLanguage = 'typescript' | 'element' | 'react' | 'vue';
export function createIntegrationCode(
  layout: LayoutName,
  appearance: GraphOptions,
  language: IntegrationLanguage,
): string {
  const options = JSON.stringify(
    Object.fromEntries(
      Object.entries(appearance).filter(
        ([key, value]) => value !== DEFAULT_OPTIONS[key as keyof GraphOptions],
      ),
    ),
    null,
    2,
  );
  const imports = `import { createCharacterGraph, parseGraphDocument } from 'character-connections';\nimport 'character-connections/style.css';\nimport rawData from './graph-data.json';`;
  if (language === 'react')
    return `import { useEffect, useRef } from 'react';
${imports}

export default function CharacterMap() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const chart = createCharacterGraph(host.current, {
      data: parseGraphDocument(rawData),
      layout: '${layout}',
      appearance: ${options},
      onSelectionChange: (selection) => console.log(selection),
    });
    return () => chart.destroy();
  }, []);
  return <div ref={host} style={{ height: 560 }} />;
}`;
  if (language === 'vue')
    return `<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
${imports}
import type { CharacterGraphComponent } from 'character-connections';

const host = ref<HTMLDivElement | null>(null);
let chart: CharacterGraphComponent | undefined;
onMounted(() => {
  if (!host.value) return;
  chart = createCharacterGraph(host.value, {
    data: parseGraphDocument(rawData),
    layout: '${layout}',
    appearance: ${options},
    onSelectionChange: (selection) => console.log(selection),
  });
});
onBeforeUnmount(() => chart?.destroy());
<\/script>

<template><div ref="host" style="height: 560px" /></template>`;
  if (language === 'element')
    return `import { registerCharacterConnections } from 'character-connections/element';
import { parseGraphDocument } from 'character-connections';
import 'character-connections/style.css';
import rawData from './graph-data.json';

registerCharacterConnections();
const chart = document.createElement('character-connections');
chart.style.height = '560px';
chart.layout = '${layout}';
chart.options = ${options};
chart.data = parseGraphDocument(rawData);
chart.addEventListener('selection-change', (event) => {
  console.log((event as CustomEvent).detail);
});
document.body.append(chart);
// Equivalent element: <character-connections layout="${layout}"></character-connections>
// Removing the element automatically releases its graph.
`;
  return `${imports}

const host = document.createElement('div');
host.style.height = '560px';
document.body.append(host);

const chart = createCharacterGraph(host, {
  data: parseGraphDocument(rawData),
  layout: '${layout}',
  appearance: ${options},
  onSelectionChange: (selection) => console.log(selection),
});

// Update without recreating the component:
// chart.update({ layout: 'mindmap', appearance: { edgeShape: 'horizontal-taxi' } });
// Call when unmounting the view:
// chart.destroy();`;
}
