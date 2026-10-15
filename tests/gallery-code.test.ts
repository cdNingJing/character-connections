import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIntegrationCode } from '../src/gallery/code.ts';
import { LAYOUT_EXAMPLES } from '../src/gallery/examples.ts';
import { DEFAULT_OPTIONS } from '../src/lib/model.ts';

test('all layout examples provide matching code and validated data boundaries', () => {
  assert.equal(new Set(LAYOUT_EXAMPLES.map((item) => item.id)).size, 8);
  for (const example of LAYOUT_EXAMPLES)
    for (const language of ['typescript', 'element', 'react', 'vue'] as const) {
      const code = createIntegrationCode(
        example.id,
        { ...DEFAULT_OPTIONS, ...example.appearance, labelFontSize: 17 },
        language,
      );
      assert.ok(code.includes('character-connections/style.css'));
      assert.ok(code.includes('graph-data.json'));
      assert.ok(code.includes('parseGraphDocument(rawData)'));
      assert.ok(code.includes(example.id));
      assert.ok(code.includes('"labelFontSize": 17'));
      if (language === 'react') assert.ok(code.includes('return () => chart.destroy()'));
      if (language === 'vue') assert.ok(code.includes('onBeforeUnmount(() => chart?.destroy())'));
    }
});
