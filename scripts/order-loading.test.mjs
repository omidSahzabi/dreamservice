import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './test-loader.mjs';

function formFixture() {
  return {
    id: 1n, form_key: 'order', show_progress: true, allow_back: true,
    submit_button_text: {fa: 'ثبت سفارش'}, translations: [{locale:'fa',title:'فرم سفارش'}],
    steps: [{id:2n,step_key:'service',step_order:1,translations:[{locale:'fa',title:'خدمات'}],fields:[{
      field_key:'service_type',field_type:'select',field_order:1,required:true,
      translations:[{locale:'fa',label:'نوع خدمت'}],placeholder:{fa:'انتخاب کنید'},
      validation:{},visibility:{},default_value:null,
      options:[{option_value:'website',option_order:1,translations:[{locale:'fa',label:'وب‌سایت'}]}],
    }]}],
  };
}

test('existing Persian-only form loads in both locales without database writes or machine-value changes',async () => {
  const form = formFixture();
  const before = structuredClone(form);
  const route = load('src/app/api/order/order-form-config/route.ts', {
    '@/lib/prisma':{prisma:{orderForm:{findFirst:async query => {
      assert.deepEqual(query.include.translations.where.locale.in,['fa','en']);
      return form;
    }}}},
  });
  const bodies = [];
  for(const locale of ['fa','en']) {
    const response = await route.GET(new Request('http://localhost/api/order/order-form-config?locale='+locale));
    assert.equal(response.status,200);
    bodies.push(await response.json());
  }
  assert.deepEqual(bodies[0],bodies[1]);
  assert.equal(bodies[1].form.steps[0].fields[0].options[0].value,'website');
  assert.deepEqual(form,before);
});

test('requested translations take priority and individual missing translations use the existing other locale',async () => {
  const form = formFixture();
  form.translations.push({locale:'en',title:'Order form'});
  form.steps[0].translations.push({locale:'en',title:'Services'});
  form.steps[0].fields[0].translations.push({locale:'en',label:'Service type'});
  const route = load('src/app/api/order/order-form-config/route.ts',{
    '@/lib/prisma':{prisma:{orderForm:{findFirst:async()=>form}}},
  });
  const response = await route.GET(new Request('http://localhost/api/order/order-form-config?locale=en'));
  assert.equal(response.status,200);
  const body = await response.json();
  assert.equal(body.form.title,'Order form');
  assert.equal(body.form.steps[0].fields[0].label,'Service type');
  assert.equal(body.form.steps[0].fields[0].options[0].label,'وب‌سایت');
  form.steps[0].fields[0].options[0].translations = [];
  assert.equal((await route.GET(new Request('http://localhost/api/order/order-form-config?locale=en'))).status,503);
});

function reviewQuery(body, permission = 'ADMIN') {
  return load('src/features/order/review-orders/hooks/use-review-orders.ts',{
    '@/hooks/useAuth':{useAuth:()=>({user:{id:'fixture',permission},isError:false})},
    '@tanstack/react-query':{useQuery:options=>options},
    '@/lib/api/errors':{...load('src/lib/api/errors.ts'),fetchJson:async()=>body},
  }).useReviewOrders({page:1,limit:10});
}

const ordersFixture = company => ({
  success:true,data:[{order_id:1,client_id:'fixture',type:null,page_count:null,budget_range:null,
    description:null,status:null,cr:null,meta:{company}}],
  pagination:{page:1,limit:10,total:1,totalPages:1,hasNextPage:false,hasPrevPage:false},
});

test('admin table query accepts existing null company values and still rejects invalid values',async () => {
  for(const company of [null,undefined,'Fixture company']) {
    const query = reviewQuery(ordersFixture(company));
    assert.equal(query.enabled,true);
    const result = await query.queryFn({});
    assert.equal(result.data.length,1);
    assert.equal(result.data[0].meta.company,company??undefined);
  }
  await assert.rejects(reviewQuery(ordersFixture({unexpected:true})).queryFn({}),error=>error.code==='ORDER_LOAD_FAILED');
  assert.equal(reviewQuery(ordersFixture(null),'CUSTOMER').enabled,false);
});
