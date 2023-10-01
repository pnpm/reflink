import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watchExclude: ['__reflink-tests-*'],
    watch: false,
  },
});
