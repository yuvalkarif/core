const replace = require('@rollup/plugin-replace');
const copy = require('rollup-plugin-copy');

const FEDERATION_DEBUG = process.env.FEDERATION_DEBUG || '';

module.exports = (rollupConfig, projectOptions) => {
  rollupConfig.input = {
    index: 'packages/runtime-core/src/index.ts',
    types: 'packages/runtime-core/src/types.ts',
  };

  const pkg = require('./package.json');

  if (rollupConfig.output.format === 'esm' && FEDERATION_DEBUG) {
    rollupConfig.output.format = 'iife';
    rollupConfig.output.inlineDynamicImports = true;
    delete rollupConfig.external;
    delete rollupConfig.input.type;
    delete rollupConfig.input.helpers;
  }

  if (Array.isArray(rollupConfig.output)) {
    rollupConfig.output = rollupConfig.output.map((c) => ({
      ...c,
      manualChunks: (id) => {
        if (id.includes('@swc/helpers')) {
          return 'polyfills';
        }
      },
    }));
  } else {
    rollupConfig.output = {
      ...rollupConfig.output,
      manualChunks: (id) => {
        if (id.includes('@swc/helpers')) {
          return 'polyfills';
        }
      },
    };
  }

  rollupConfig.plugins.push(
    replace({
      preventAssignment: true,
      __VERSION__: JSON.stringify(pkg.version),
      FEDERATION_DEBUG: JSON.stringify(FEDERATION_DEBUG),
    }),
    copy({
      targets: [
        {
          src: 'packages/runtime-core/LICENSE',
          dest: 'packages/runtime-core/dist',
        },
      ],
    }),
  );

  return rollupConfig;
};
