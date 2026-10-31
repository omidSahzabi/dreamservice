// Disposable production-server verification only. Never imported by the app.
const target = new URL(process.env.DATABASE_URL || 'http://invalid');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !/^\/dreamservice_phase1_test_[a-f0-9]{32}$/.test(target.pathname)) throw new Error('Disposable provider target required');
const originalFetch = globalThis.fetch;
const crypto = process.getBuiltinModule('crypto');
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const otpEndpoint = url.href === 'https://api.iranpayamak.com/ws/v1/sms/pattern';
  if (otpEndpoint || url.href === 'https://edge.ippanel.com/v1/api/send') {
    const body = JSON.parse(init.body);
    const code = otpEndpoint ? body.attributes?.code : body.params?.code;
    if (typeof code === 'string' && /^\d{5}$/.test(code)) {
      const phone = otpEndpoint ? body.recipient : '0' + body.recipients[0].slice(3);
      // Test parent receives this transiently through IPC. Never log the code,
      // phone, payload, session, or provider credentials.
      process.send?.({ type: 'phase1-otp', target: crypto.createHash('sha256').update(phone).digest('hex'), code });
    }
    process.send?.({ type: 'phase1-provider-mocked' });
    return otpEndpoint ? Response.json({status:'success',data:1},{status:201}) : Response.json({ meta: { status: true, message_code: '200-1' }, data: { message_outbox_ids: [1] } });
  }
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return originalFetch(input, init);
  throw new Error('External HTTP forbidden in isolated browser verification');
};
