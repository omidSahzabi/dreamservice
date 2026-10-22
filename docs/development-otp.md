# Local OTP console delivery

`OTP_DELIVERY_MODE=console` works only with `NODE_ENV=development`, as set by
`npm run dev`. The generated phone/code pair appears only in the Next.js server
terminal, after the challenge is committed and its delivery state is saved as
SENT. API responses never include the code. Database persistence, binding,
expiration, rate/attempt limits, grants, and sessions follow the existing flow.
Production and other environments reject this mode with HTTP 503 and no delivery.
An absent or different flag preserves normal SMS behavior, with no console fallback.

Stop the current dev server, then run the following in PowerShell. The key command
privately generates a temporary development key into this terminal's environment;
it does not print the key or edit environment files. Use your existing stable key
instead if one is already configured. Keep the same key during your test session.

```powershell
$env:NODE_ENV = "development"
$env:OTP_DELIVERY_MODE = "console"
$env:SECURITY_OTP_KEY = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
$env:SECURITY_ORIGIN = "http://localhost:3000"
npm run dev -- --port 3000
```

Keep the existing approved local `DATABASE_URL` configuration. Open
`http://localhost:3000/en` or `/fa`, open login, enter a phone number, and request
the code. Read the `[development OTP]` line in the server terminal and enter that
code in the same browser within 120 seconds. Existing customers log in; an unknown
verified phone completes the normal registration form. Resend still has a
60-second cooldown and shared budgets; verification still allows five attempts.

For persistence across terminal sessions, add `OTP_DELIVERY_MODE=console` to an
existing local environment file without replacing its other entries. Configure
a private, stable `SECURITY_OTP_KEY` of at least 32 bytes there through your usual
local secret mechanism. `.env.example` documents only the optional delivery flag;
never copy it over an existing environment file. Restart Next.js after changing
configuration. Clear the console flag when returning to normal SMS delivery.

## HTTP 500 investigation and validation

The current development environment resolves only `.env`, with a configured
database URL but no `SECURITY_OTP_KEY`. The real rate-limit implementation calls
the protected HMAC helper before OTP delivery; the missing key throws and the
handler returns HTTP 500 `UNKNOWN`. Regression tests reproduce that failure with
both normal and console delivery. A disabled/unavailable SMS provider instead
returns HTTP 502 `SMS_FAILED`; it does not explain this configuration-related 500.
No matching historical request trace was available to attribute a past request
independently of the current configuration.

Sixteen focused regression cases cover console success, persistence-before-output,
database failures, production/test rejection, unchanged SMS failure behavior,
binding/expiry/attempts/cooldown, login/replay, registration grants, and the missing
key diagnosis. Together with existing tests, 138 automated cases passed.
Tests capture console output, block external services, and use only in-memory
fixtures; no database rows or real local environment files were changed.
TypeScript and lint passed; lint retains the five previously reported warnings.
