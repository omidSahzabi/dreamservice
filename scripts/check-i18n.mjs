import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {parse} from '@formatjs/icu-messageformat-parser';

const root = path.resolve(import.meta.dirname, '..');
const catalogs = Object.fromEntries(['en', 'fa'].map(locale => {
  const file = path.join(root, 'messages', locale + '.json');
  const text = fs.readFileSync(file, 'utf8');
  function checkDuplicates(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = node.properties.map(property => property.name?.text);
      assert.equal(new Set(keys).size, keys.length, 'Duplicate JSON keys in ' + file);
    }
    ts.forEachChild(node, checkDuplicates);
  }
  checkDuplicates(ts.parseJsonText(file, text));
  return [locale, JSON.parse(text)];
}));
function flatten(value, prefix = '', result = {}) {
  result[prefix] = Array.isArray(value) ? 'array' : typeof value;
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) flatten(item, prefix ? prefix + '.' + key : key, result);
  }
  return result;
}
function resolve(catalog, key) {
  return key.split('.').reduce((value, part) => value?.[part], catalog);
}
function signature(nodes, result = new Set()) {
  for (const node of nodes) {
    if ([1, 2, 3, 4, 5, 6, 8].includes(node.type)) result.add(node.type + ':' + node.value);
    if (node.children) signature(node.children, result);
    if (node.options) for (const option of Object.values(node.options)) signature(option.value, result);
  }
  return [...result].sort();
}
assert.deepEqual(flatten(catalogs.en), flatten(catalogs.fa), 'Catalog paths/types differ');
let messageCount = 0;
for (const [key, type] of Object.entries(flatten(catalogs.en))) {
  if (type !== 'string') continue;
  const en = resolve(catalogs.en, key);
  const fa = resolve(catalogs.fa, key);
  assert.ok(en.trim() && fa.trim(), 'Empty message: ' + key);
  assert.deepEqual(signature(parse(en)), signature(parse(fa)), 'ICU contract differs: ' + key);
  messageCount++;
}

function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
function literal(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}
function namespaceOf(node) {
  if (ts.isAwaitExpression(node)) return namespaceOf(node.expression);
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !['useTranslations', 'getTranslations'].includes(node.expression.text)) return;
  const argument = node.arguments[0];
  if (!argument) return '';
  if (literal(argument) !== undefined) return literal(argument);
  if (ts.isObjectLiteralExpression(argument)) {
    const property = argument.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === 'namespace');
    if (property) return literal(property.initializer);
  }
}

let staticCount = 0;
const dynamic = [];
for (const file of [...files(path.join(root, 'src')), ...files(path.join(root, 'i18n'))]) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const translators = new Map();
  function discover(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const namespace = namespaceOf(node.initializer);
      if (namespace !== undefined) translators.set(node.name.text, namespace);
    }
    ts.forEachChild(node, discover);
  }
  discover(source);
  function inspect(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const name = ts.isIdentifier(expression) ? expression.text : ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) ? expression.expression.text : undefined;
      if (name && translators.has(name)) {
        const namespace = translators.get(name);
        const key = literal(node.arguments[0]);
        if (key !== undefined) {
          const full = namespace ? namespace + '.' + key : key;
          for (const locale of ['en', 'fa']) assert.equal(typeof resolve(catalogs[locale], full), 'string', file + ': missing ' + full);
          staticCount++;
        } else dynamic.push({file: path.relative(root, file).replaceAll('\\', '/'), namespace, expression: node.arguments[0]?.getText(source)});
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}

// Explicit finite contracts for consumers whose keys are assembled at runtime.
const finite = {
  'About.Values': ['one', 'two', 'three'].flatMap(key => ['items.' + key + '.title', 'items.' + key + '.description']),
  Packages: ['support', 'mentorship', 'store', 'seo', 'web', 'backend', 'frontend', 'placeholder', 'app'].flatMap(key => ['items.' + key + '.title', 'items.' + key + '.description']),
  Projects: ['store', 'dashboard', 'mobile', 'personal', 'crm', 'education', 'game'].flatMap(key => ['items.' + key + '.title', 'items.' + key + '.description']),
  CallToAction: [...['collaborate', 'consultation', 'projects', 'contact'], ...['speed', 'security', 'support', 'team', 'quality', 'care'].flatMap(key => ['features.' + key + '.title', 'features.' + key + '.description'])],
  Navbar: Object.keys(catalogs.en.Navbar.roles).map(key => 'roles.' + key),
  DataTable: ['compact', 'default', 'comfortable'],
  OrderStatus: ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REJECTED'],
  Metadata: ['home', 'about', 'order', 'orderForm', 'reviewOrders'].flatMap(key => ['pages.' + key + '.title', 'pages.' + key + '.description'])
};
for (const [namespace, keys] of Object.entries(finite)) {
  for (const key of keys) for (const locale of ['en', 'fa']) assert.equal(typeof resolve(catalogs[locale], namespace + '.' + key), 'string', 'Missing finite key ' + namespace + '.' + key);
}
const allowedDynamic = new Set([
  'src/components/templates/about/AboutValues.tsx', 'src/components/templates/about/TeamCard.tsx',
  'src/components/templates/Packages.tsx', 'src/components/templates/sampleProjects/SampleProjects.tsx',
  'src/components/templates/callToAction/CallToAction.tsx', 'src/components/modules/navbar/AuthButton.tsx',
  'src/components/modules/navbar/ThemeToggle.tsx', 'src/components/modules/data-table/data-table-density.tsx',
  'src/features/order/review-orders/components/order-status-badge.tsx', 'src/lib/i18n/metadata.ts'
]);
for (const consumer of dynamic) assert.ok(allowedDynamic.has(consumer.file), 'Unverified dynamic consumer: ' + JSON.stringify(consumer));

// Catch drift between the actual source arrays and the finite contracts above.
function checkSourceSet(file, variable, property, expected) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  let actual;
  function inspect(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === variable && node.initializer) {
      let value = node.initializer;
      if (ts.isAsExpression(value)) value = value.expression;
      if (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression)) value = value.expression.expression;
      if (ts.isArrayLiteralExpression(value)) actual = value.elements.map(item => {
        if (!property) return literal(item);
        const field = item.properties?.find(entry => ts.isPropertyAssignment(entry) && entry.name.getText(source) === property);
        return field ? literal(field.initializer) : undefined;
      });
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
  assert.deepEqual(actual, expected, 'Finite source set drifted: ' + file + ':' + variable);
}
checkSourceSet('src/components/templates/about/AboutValues.tsx', 'values', 'key', ['one', 'two', 'three']);
checkSourceSet('src/components/templates/Packages.tsx', 'packages', null, ['support', 'mentorship', 'store', 'seo', 'web', 'backend', 'frontend', 'placeholder', 'app']);
checkSourceSet('src/components/templates/sampleProjects/SampleProjects.tsx', 'keys', null, ['store', 'dashboard', 'mobile', 'personal', 'crm', 'education', 'game']);
checkSourceSet('src/components/templates/callToAction/features.tsx', 'features', 'key', ['speed', 'security', 'support', 'team', 'quality', 'care']);
checkSourceSet('src/components/templates/callToAction/features.tsx', 'buttons', 'key', ['collaborate', 'consultation', 'projects', 'contact']);
console.log('PASS: ' + messageCount + ' bilingual messages; path/type and ICU parity; ' + staticCount + ' static calls; ' + dynamic.length + ' dynamic calls covered by finite contracts/guards.');
