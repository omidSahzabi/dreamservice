// Disposable production-server verification only. Never imported by the app.
const target = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !/^\/dreamservice_phase1_test_[a-f0-9]{32}$/.test(target.pathname)) throw new Error('Disposable provider target required');
const originalFetch = globalThis.fetch;
const crypto = process.getBuiltinModule('crypto');
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.href === 'https://edge.ippanel.com/v1/api/send') {
    const body = JSON.parse(init.body);
    if (typeof body.params?.code === 'string' && /^\d{5}$/.test(body.params.code)) {
      const phone = '0' + body.recipients[0].slice(3);
      // Test parent receives this transiently through IPC. Never log the code,
      // phone, payload, session, or provider credentials.
      process.send?.({ type: 'phase1-otp', target: crypto.createHash('sha256').update(phone).digest('hex'), code: body.params.code });
    }
    process.send?.({ type: 'phase1-provider-mocked' });
    return Response.json({ meta: { status: true, message_code: '200-1' }, data: { message_outbox_ids: [1] } });
  }
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return originalFetch(input, init);
  throw new Error('External HTTP forbidden in isolated browser verification');
};
