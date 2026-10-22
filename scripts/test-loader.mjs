import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire, registerHooks} from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
registerHooks({resolve(specifier, context, nextResolve) {
  return nextResolve(['next/server','next/navigation'].includes(specifier) ? specifier + '.js' : specifier, context);
}});

export function load(relative, overrides = {}) {
  const cache = new Map();
  function read(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX}
    }).outputText;
    const compiled = {exports: {}};
    cache.set(filename, compiled);
    function localRequire(name) {
      if (name in overrides) return overrides[name];
      if (name === 'server-only') return {};
      if (name === '@/lib/prisma') throw new Error('Tests must provide an in-memory Prisma substitute');
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(filename), name);
        const resolved = ['.ts', '.tsx', '/index.ts', '/index.tsx'].map(extension => target + extension).find(candidate => fs.existsSync(candidate));
        if (!resolved) throw new Error('Missing test module: ' + name);
        return read(resolved);
      }
      return require(name);
    }
    vm.runInThisContext('(function(require,module,exports){' + source + '\n})', {filename})(localRequire, compiled, compiled.exports);
    return compiled.exports;
  }
  return read(relative);
}
