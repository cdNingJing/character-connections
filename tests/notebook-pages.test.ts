import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAllNotebookPages } from '../src/lib/notebook-pages.ts';
import { createJourneyDocument } from '../src/data/journey.ts';
import { DEFAULT_OPTIONS } from '../src/lib/model.ts';
import { LAYOUT_EXAMPLES } from '../src/gallery/examples.ts';
import { createIntegrationCode } from '../src/gallery/code.ts';

test('all layouts keep every character and paginate relations into bounded rows', () => {
  const document = createJourneyDocument(3);
  for (const example of LAYOUT_EXAMPLES) {
    const pages = createAllNotebookPages(
      document,
      example.id,
      { ...DEFAULT_OPTIONS, crossGroupVisibility: 'all' },
      null,
    );
    assert.equal(
      pages
        .filter((p) => p.kind === 'characters')
        .flatMap((p) => (p.kind === 'characters' ? p.sections.flatMap((s) => s.characters) : []))
        .length,
      26,
    );
    assert.equal(
      pages
        .filter((p) => p.kind === 'relations')
        .flatMap((p) => (p.kind === 'relations' ? p.relations : [])).length,
      43,
    );
    for (const page of pages)
      if (page.kind === 'relations') assert.ok(page.relations.length <= 11);
      else {
        assert.ok(
          page.sections.reduce(
            (sum, section) => sum + 46 + Math.ceil(section.characters.length / 4) * 68,
            0,
          ) <= 820,
        );
        assert.ok(page.sections.every((s) => s.characters.length <= 12));
      }
  }
});
test('selection expands only matching cross-group relations without changing character pages', () => {
  const document = createJourneyDocument(3),
    options = { ...DEFAULT_OPTIONS, crossGroupVisibility: 'selected' as const };
  const initial = createAllNotebookPages(document, 'groups', options, null),
    selected = createAllNotebookPages(document, 'groups', options, {
      kind: 'character',
      id: 'guanyin',
    });
  assert.deepEqual(
    initial.filter((p) => p.kind === 'characters'),
    selected.filter((p) => p.kind === 'characters'),
  );
  assert.equal(initial.flatMap((p) => (p.kind === 'relations' ? p.relations : [])).length, 13);
  assert.equal(selected.flatMap((p) => (p.kind === 'relations' ? p.relations : [])).length, 17);
});
test('500 characters paginate without overflowing a paper page', () => {
  const document = createJourneyDocument(0);
  document.characters = Array.from({ length: 500 }, (_, i) => ({
    id: `c${i}`,
    name: `人物${i}`,
    group: `组${Math.floor(i / 19)}`,
  }));
  document.relations = [];
  const pages = createAllNotebookPages(document, 'groups', DEFAULT_OPTIONS, null);
  assert.ok(pages.length > 1);
  assert.equal(
    pages.flatMap((p) => (p.kind === 'characters' ? p.sections.flatMap((s) => s.characters) : []))
      .length,
    500,
  );
  for (const page of pages)
    if (page.kind === 'characters')
      assert.ok(
        page.sections.reduce((sum, s) => sum + 46 + Math.ceil(s.characters.length / 4) * 68, 0) <=
          820,
      );
});
test('paper integration snippets use notebook components with lifecycle cleanup', () => {
  for (const language of ['typescript', 'element', 'react', 'vue'] as const) {
    const code = createIntegrationCode('groups', DEFAULT_OPTIONS, language, 'paper');
    assert.ok(
      code.includes('createCharacterNotebook') || code.includes('registerCharacterNotebook'),
    );
    assert.ok(!code.includes('createCharacterGraph'));
  }
});
