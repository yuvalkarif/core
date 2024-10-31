if (globalThis.__FEDERATION__) {
  globalThis.__GLOBAL_LOADING_REMOTE_ENTRY__ = {};
  //@ts-ignore
  globalThis.__FEDERATION__.__INSTANCES__.map((i) => {
    i.moduleCache.clear();
    if (globalThis[i.name]) {
      delete globalThis[i.name];
    }
  });
  globalThis.__FEDERATION__.__INSTANCES__ = [];
  globalThis.__FEDERATION__.__SHAREABLE_RUNTIME__ = undefined;
}
const { describeCases } = require('./ConfigTestCases.template');
jest.resetModules();
describeCases({
  name: 'ShareableRuntime',
  federation: {
    federationRuntime: 'use-host',
  },
});
