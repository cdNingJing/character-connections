import { createCharacterGraph, parseGraphDocument } from 'character-connections';
import { registerCharacterConnections } from 'character-connections/element';
import 'character-connections/style.css';
import rawData from '../../examples/journey-stage-2.json';

const results: Record<string, boolean> = {};
const wait = () => new Promise((resolve) => setTimeout(resolve, 80));
const check = (name: string, value: boolean) => {
  results[name] = value;
  if (!value) throw new Error(name);
};
async function runAllChecks() {
  const data = parseGraphDocument(rawData);
  const host = document.createElement('div');
  host.style.cssText = 'width:800px;height:400px';
  document.body.append(host);
  let selected = '';
  const chart = createCharacterGraph(host, {
    data,
    layout: 'mindmap',
    appearance: { transition: 'none', nodeShape: 'diamond' },
    onSelectionChange: (value) => {
      selected = value?.id ?? '';
    },
  });
  await wait();
  check('package renders data', chart.graph.core.nodes().length === data.characters.length);
  chart.update({ appearance: { edgeWidth: 3 } });
  chart.update({ data });
  check(
    'partial appearance updates merge',
    chart.exportData().appearance?.nodeShape === 'diamond' &&
      chart.exportData().appearance?.edgeWidth === 3,
  );
  const previous = JSON.stringify(chart.exportData());
  try {
    chart.update({ appearance: { nodeSize: -1 } });
  } catch {}
  check('invalid update preserves current graph', JSON.stringify(chart.exportData()) === previous);
  chart.graph.selectCharacterById(data.characters[0].id);
  check('selection callback', selected === data.characters[0].id);
  chart.graph.core.getElementById(data.characters[0].id).position({ x: 42, y: 56 });
  chart.update({ data, preservePositions: true });
  check(
    'incremental update preserves positions',
    chart.graph.core.getElementById(data.characters[0].id).position('x') === 42,
  );
  chart.destroy();
  chart.destroy();
  check('destroy releases canvas', chart.graph.core.destroyed());
  let rejected = false;
  try {
    chart.update({ layout: 'grid' });
  } catch {
    rejected = true;
  }
  check('destroyed instance rejects updates', rejected);
  registerCharacterConnections();
  registerCharacterConnections();
  const element = document.createElement('character-connections');
  element.style.cssText = 'width:800px;height:400px';
  element.layout = 'grid';
  element.options = { transition: 'none' };
  element.data = data;
  document.body.append(element);
  await wait();
  check('custom element mounts', !!element.querySelector('canvas'));
  check(
    'custom element exports data',
    element.exportData()?.characters.length === data.characters.length,
  );
  element.remove();
  await wait();
  check('custom element unmounts', !element.querySelector('canvas'));
  document.body.append(element);
  await wait();
  check('custom element remounts', !!element.querySelector('canvas'));
  element.remove();
  host.remove();
  await wait();
  document.querySelector('#result')!.textContent = JSON.stringify(results);
}
runAllChecks().catch((error) => {
  document.querySelector('#result')!.textContent = JSON.stringify({
    results,
    error: String(error),
  });
  throw error;
});
