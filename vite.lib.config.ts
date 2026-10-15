import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'dist/lib',
    lib: {
      entry: { index: 'src/lib/index.ts', element: 'src/lib/element.ts' },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: 'character-connections',
    },
    rolldownOptions: { external: ['cytoscape'] },
  },
});
