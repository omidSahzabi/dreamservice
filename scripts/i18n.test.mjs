import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire, registerHooks} from 'node:module';
import ts from 'typescript';
import {createTranslator, createFormatter} from 'use-intl/core';
import {NextRequest} from 'next/server.js';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
// Next's bundler resolves extensionless framework imports; native Node needs the extension.
registerHooks({resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
}});
function load(relative, overrides = {}) {
  const filename = path.resolve(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true}
  }).outputText;
  const compiledModule = {exports: {}};
  const localRequire = name => {
    if (name in overrides) return overrides[name];
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', overrides);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), overrides);
    return require(name);
  };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})', {filename})(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const messages = Object.fromEntries(['en', 'fa'].map(locale => [locale, JSON.parse(fs.readFileSync(path.join(root, 'messages', locale + '.json'), 'utf8'))]));
const errors = load('src/lib/api/errors.ts');
const schemas = load('src/schemas/orderSchema.ts');
const {orderFormConfigSchema} = load('src/schemas/orderFormConfig.ts');

test('order submission accepts legacy flat JSON and preserves wrapped form keys', async () => {
  const created = [];
  const {POST} = load('src/app/api/order/submit-order/route.ts', {
    '@/lib/prisma': {prisma: {order: {create: async ({data}) => {
      created.push(data);
      return {order_id: 'fixture-order'};
    }}}}
  });
  const data = {type: 'web', budget_range: 'small', description: 'Synthetic fixture'};
  for (const body of [data, {formKey: 'order', data}]) {
    const response = await POST(new Request('http://localhost/api/order/submit-order', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    }));
    assert.equal(response.status, 201);
  }
  assert.equal('formKey' in created[0].meta, false);
  assert.equal(created[1].meta.formKey, 'order');
  assert.equal(created[0].meta.type, data.type);
  assert.equal(created[1].meta.budget_range, data.budget_range);
});

test('all stable API errors translate safely in both locales', () => {
  for (const locale of ['en', 'fa']) {
    const t = createTranslator({locale, messages: messages[locale], namespace: 'Errors', onError: error => {throw error;}});
    for (const code of errors.errorCodes) {
      const error = errors.readApiError({code, retryAfter: 12, remainingAttempts: 2, error: 'DO_NOT_DISPLAY'}, 'UNKNOWN');
      const message = errors.localizeApiError(error, t);
      assert.ok(message && !message.includes('DO_NOT_DISPLAY') && message !== code);
    }
    assert.equal(errors.localizeApiError(new Error('DO_NOT_DISPLAY'), t), t('UNKNOWN'));
    assert.equal(errors.readApiError({code: 'UNKNOWN_CODE', message: 'DO_NOT_DISPLAY'}, 'ORDER_LOAD_FAILED').code, 'ORDER_LOAD_FAILED');
  }
});

test('network and malformed failures never surface server text', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => {throw new Error('PRIVATE');};
    await assert.rejects(errors.fetchJson('/api/test', 'UNKNOWN'), error => error.code === 'NETWORK_ERROR');
    globalThis.fetch = async () => new Response('not JSON: PRIVATE', {status: 500});
    await assert.rejects(errors.fetchJson('/api/test', 'ORDER_LOAD_FAILED'), error => error.code === 'ORDER_LOAD_FAILED');
  } finally {globalThis.fetch = original;}
});

test('Persian and Arabic input digits normalize without changing identifiers', () => {
  const {normalizeDigits} = load('src/lib/i18n/digits.ts');
  assert.equal(normalizeDigits('۰۹۱۲٣٤٥٦٧٨٩'), '09123456789');
  assert.equal(normalizeDigits('web_store'), 'web_store');
});

test('every dynamic field type and existing constraint uses localized validation', () => {
  for (const locale of ['en', 'fa']) {
    const t = createTranslator({locale, messages: messages[locale], namespace: 'OrderForm', onError: error => {throw error;}});
    const cases = [
      [{type: 'text', required: true}, undefined, 'required'],
      [{type: 'email'}, 'bad-email', 'email'],
      [{type: 'tel', validation: {pattern: '^09[0-9]{9}$'}}, 'bad-phone', 'pattern'],
      [{type: 'textarea', validation: {minLength: 3}}, 'x', 'minLength', {count: 3}],
      [{type: 'text', validation: {maxLength: 3}}, 'long', 'maxLength', {count: 3}],
      [{type: 'number'}, '12', 'number'],
      [{type: 'number', validation: {min: 3}}, 2, 'min', {value: 3}],
      [{type: 'number', validation: {max: 3}}, 4, 'max', {value: 3}],
      [{type: 'select', required: true}, '', 'required'],
      [{type: 'radio', required: true}, '', 'required'],
      [{type: 'checkbox', required: true}, [], 'selection']
    ];
    for (const [field, value, key, values] of cases) {
      const step = {id: 's', title: 'Fixture', order: 1, fields: [{id: 'value', label: 'Fixture', ...field}]};
      const result = schemas.createStepSchema(step, {value}, t).safeParse({value});
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].message, t('validation.' + key, values));
    }
    const optionalEmail = {id: 's', title: 'Fixture', order: 1, fields: [{id: 'email', label: 'Fixture', type: 'email'}]};
    assert.equal(schemas.createStepSchema(optionalEmail, {}, t).safeParse({email: ''}).success, true);
  }
});

test('visibility uses current stable values with both condition operators', () => {
  const field = {id: 'details', label: 'Fixture', type: 'text', required: true,
    visibility: {operator: 'AND', conditions: [{field: 'type', operator: 'equals', value: 'web_store'}]}};
  const step = {id: 's', title: 'Fixture', order: 1, fields: [field]};
  assert.equal(schemas.getVisibleFields(step, {type: 'web_store'}).length, 1);
  assert.equal(schemas.getVisibleFields(step, {type: 'app'}).length, 0);
  field.visibility.conditions[0].operator = 'not_equals';
  assert.equal(schemas.getVisibleFields(step, {type: 'app'}).length, 1);
});

const fixture = locale => ({form: {
  id: '1', key: 'order', title: locale === 'en' ? 'Order fixture' : 'فرم آزمایشی',
  settings: {showProgress: true, allowBack: true, submitButtonText: ''},
  steps: [{id: '1', title: locale === 'en' ? 'Details' : 'جزئیات', order: 1, fields: [{
    id: 'service_type', type: 'select', label: locale === 'en' ? 'Service' : 'خدمت', required: true,
    validation: {}, visibility: {}, defaultValue: 'web_store',
    options: [{value: 'web_store', label: locale === 'en' ? 'Store' : 'فروشگاه'}]
  }]}]
}});
test('form contracts accept database defaults and preserve machine values between locales', () => {
  const en = orderFormConfigSchema.parse(fixture('en'));
  const fa = orderFormConfigSchema.parse(fixture('fa'));
  assert.equal(en.form.key, 'order');
  assert.deepEqual(en.form.steps[0].fields[0].visibility, undefined);
  assert.equal(en.form.steps[0].fields[0].id, fa.form.steps[0].fields[0].id);
  assert.equal(en.form.steps[0].fields[0].options[0].value, fa.form.steps[0].fields[0].options[0].value);
  const missing = fixture('fa');
  missing.form.steps[0].fields[0].options[0].label = '';
  assert.equal(orderFormConfigSchema.safeParse(missing).success, false);
});

test('form API rejects unsupported locales and missing translations without writes', async () => {
  let reads = 0;
  const route = load('src/app/api/order/order-form-config/route.ts', {
    '@/lib/prisma': {prisma: {orderForm: {findFirst: async () => {reads++; return {
      id: 1, form_key: 'order', translations: [], steps: []
    };}}}}
  });
  const invalid = await route.GET(new Request('http://localhost/api/order/order-form-config?locale=de'));
  assert.equal(invalid.status, 400);
  assert.equal(reads, 0);
  for (const locale of ['en', 'fa']) {
    const response = await route.GET(new Request('http://localhost/api/order/order-form-config?locale=' + locale));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'FORM_TRANSLATION_MISSING');
  }
});

test('form API emits localized database labels with unchanged option values', async () => {
  for (const locale of ['en', 'fa']) {
    const expected = fixture(locale).form.steps[0].fields[0];
    const route = load('src/app/api/order/order-form-config/route.ts', {
      '@/lib/prisma': {prisma: {orderForm: {findFirst: async () => ({
        id: 1n, form_key: 'order', translations: [{title: fixture(locale).form.title}],
        show_progress: true, allow_back: true, submit_button_text: {},
        steps: [{id: 1n, step_key: 'details', step_order: 1, translations: [{title: 'Fixture'}],
          fields: [{field_key: expected.id, field_type: expected.type, required: true,
            translations: [{label: expected.label}], placeholder: {[locale]: 'Fixture placeholder'},
            validation: {}, visibility: {}, default_value: 'web_store',
            options: [{option_value: 'web_store', translations: [{label: expected.options[0].label}], metadata: {}}]
          }]
        }]
      })}}}
    });
    const response = await route.GET(new Request('http://localhost/api/order/order-form-config?locale=' + locale));
    assert.equal(response.status, 200);
    const field = (await response.json()).form.steps[0].fields[0];
    assert.equal(field.id, 'service_type');
    assert.equal(field.options[0].value, 'web_store');
    assert.equal(field.options[0].label, expected.options[0].label);
    assert.equal(field.placeholder, 'Fixture placeholder');
  }
});

test('middleware negotiates supported locales and excludes API/public assets', () => {
  const middleware = load('middleware.ts');
  assert.deepEqual(load('src/middleware.ts').config, middleware.config, 'Middleware adapter matcher drifted');
  const matcher = new RegExp('^' + middleware.config.matcher[0] + '$');
  for (const url of ['/api/order/load-orders', '/_next/static/test.js', '/images/rahnama.pdf', '/favicon.ico']) assert.equal(matcher.test(url), false);
  for (const locale of ['en', 'fa']) {
    const response = middleware.default(new NextRequest('http://localhost/' + locale + '/about?source=test'));
    assert.equal(response.headers.get('location'), null);
  }
  const response = middleware.default(new NextRequest('http://localhost/?source=test', {headers: {'accept-language': 'fa'}}));
  assert.equal(response.headers.get('location'), 'http://localhost/fa?source=test');
  const unsupported = middleware.default(new NextRequest('http://localhost/de/about', {headers: {'accept-language': 'en'}}));
  assert.equal(unsupported.headers.get('location'), 'http://localhost/en/de/about');
});

test('counts, percentages, plurals and metadata use each locale', () => {
  for (const locale of ['en', 'fa']) {
    const format = createFormatter({locale});
    const t = createTranslator({locale, messages: messages[locale], namespace: 'ReviewOrders', onError: error => {throw error;}});
    assert.equal(format.number(1250), new Intl.NumberFormat(locale).format(1250));
    assert.equal(format.number(0.5, {style: 'percent'}), new Intl.NumberFormat(locale, {style: 'percent'}).format(0.5));
    for (const count of [0, 1, 2, 1000]) assert.ok(t('totalCount', {count}));
    for (const page of ['home', 'about', 'order', 'orderForm', 'reviewOrders']) assert.ok(messages[locale].Metadata.pages[page].title);
  }
});
