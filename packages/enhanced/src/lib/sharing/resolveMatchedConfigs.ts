/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra, Zackary Jackson @ScriptedAlchemy
*/
import { normalizeWebpackPath } from '@module-federation/sdk/normalize-webpack-path';
import type { Compilation } from 'webpack';
import type { ResolveOptionsWithDependencyType } from 'webpack/lib/ResolverFactory';
import type { SemVerRange } from 'webpack/lib/util/semver';
import type { ConsumeOptions } from './ConsumeSharedModule';

const ModuleNotFoundError = require(
  normalizeWebpackPath('webpack/lib/ModuleNotFoundError'),
) as typeof import('webpack/lib/ModuleNotFoundError');
const LazySet = require(
  normalizeWebpackPath('webpack/lib/util/LazySet'),
) as typeof import('webpack/lib/util/LazySet');

const RELATIVE_REQUEST_REGEX = /^\.\.?(\/|$)/;
const ABSOLUTE_PATH_REGEX = /^(\/|[A-Za-z]:\\|\\\\)/;

interface MatchedConfigs<T> {
  resolved: Map<string, T>;
  unresolved: Map<string, T>;
  prefixed: Map<string, T>;
}

const RESOLVE_OPTIONS: ResolveOptionsWithDependencyType = {
  dependencyType: 'esm',
};

function createCompositeKey(request: string, config: ConsumeOptions): string {
  // First determine the base key to use
  const baseRequest =
    config.import && request !== config.import ? config.import : request;
  const key =
    config.shareKey && request !== config.shareKey
      ? config.shareKey
      : baseRequest;

  if (config.issuerLayer) {
    return `(${config.issuerLayer})${key}`;
  } else if (config.layer) {
    return `(${config.layer})${key}`;
  } else {
    // return original request for key
    return request;
  }
}
// TODO: look at passing dedicated request key instead of infer from object key
export async function resolveMatchedConfigs<T extends ConsumeOptions>(
  compilation: Compilation,
  configs: [string, T][],
): Promise<MatchedConfigs<T>> {
  const resolved = new Map<string, T>();
  const unresolved = new Map<string, T>();
  const prefixed = new Map<string, T>();
  const resolveContext = {
    fileDependencies: new LazySet<string>(),
    contextDependencies: new LazySet<string>(),
    missingDependencies: new LazySet<string>(),
  };
  const resolver = compilation.resolverFactory.get('normal', RESOLVE_OPTIONS);
  const context = compilation.compiler.context;

  await Promise.all(
    configs.map(([request, config]) => {
      if (RELATIVE_REQUEST_REGEX.test(request)) {
        // relative request
        return new Promise<void>((resolve) => {
          resolver.resolve(
            {},
            context,
            request,
            resolveContext,
            (err, result) => {
              if (err || result === false) {
                err = err || new Error(`Can't resolve ${request}`);
                compilation.errors.push(
                  new ModuleNotFoundError(null, err, {
                    name: `shared module ${request}`,
                  }),
                );
                return resolve();
              }
              resolved.set(result as string, config);
              resolve();
            },
          );
        });
      } else if (ABSOLUTE_PATH_REGEX.test(request)) {
        // absolute path
        resolved.set(request, config);
        return undefined;
      } else if (request.endsWith('/')) {
        // module request prefix
        prefixed.set(request, config);
        return undefined;
      } else {
        // module request
        const key = createCompositeKey(request, config);
        unresolved.set(key, config);
        // handle using normal key when request and share key do not differ
        if (request === config.shareKey && !unresolved.has(request)) {
          unresolved.set(request, config);
        } else if (
          request !== config.shareKey &&
          request !== config.import &&
          config.import !== config.shareKey &&
          !unresolved.has(request)
        ) {
          // if request(key), shareKey, and import are all different, add the aliased resolve as the original key
          unresolved.set(request, config);
        }
        return undefined;
      }
    }),
  );
  compilation.contextDependencies.addAll(resolveContext.contextDependencies);
  compilation.fileDependencies.addAll(resolveContext.fileDependencies);
  compilation.missingDependencies.addAll(resolveContext.missingDependencies);
  return { resolved, unresolved, prefixed };
}
