export const errorCodes = [
  'UNKNOWN', 'NETWORK_ERROR', 'INVALID_INPUT', 'INVALID_PHONE',
  'OTP_EXPIRED', 'OTP_INVALID', 'OTP_NOT_FOUND', 'OTP_USED',
  'OTP_ATTEMPTS_EXCEEDED', 'OTP_RATE_LIMIT', 'SMS_FAILED',
  'REGISTRATION_EXPIRED', 'EMAIL_INVALID', 'REGISTER_FAILED',
  'UNAUTHENTICATED', 'FORBIDDEN', 'INVALID_ROLE', 'LOGOUT_FAILED',
  'ORDER_SUBMIT_FAILED', 'ORDER_LOAD_FAILED', 'ORDER_INVALID',
  'FORM_TRANSLATION_MISSING', 'FORM_NOT_FOUND', 'FORM_LOAD_FAILED'
] as const;

export type ApiErrorCode = typeof errorCodes[number];
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly values: Record<string, number> = {}
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export function readApiError(value: unknown, fallback: ApiErrorCode): ApiError {
  if (!value || typeof value !== 'object') return new ApiError(fallback);
  const code = 'code' in value ? value.code : undefined;
  const resolved = errorCodes.find(candidate => candidate === code) ?? fallback;
  const values: Record<string, number> = {};
  for (const [source, target] of [['retryAfter', 'seconds'], ['remainingAttempts', 'attempts']] as const) {
    if (source in value) {
      const count = Reflect.get(value, source);
      if (typeof count === 'number' && Number.isFinite(count) && count >= 0) values[target] = count;
    }
  }
  if (resolved === 'OTP_INVALID') values.attempts ??= 0;
  if (resolved === 'OTP_RATE_LIMIT') values.seconds ??= 0;
  return new ApiError(resolved, values);
}

export function localizeApiError(
  error: unknown,
  t: (key: string, values?: Record<string, number>) => string
): string {
  return error instanceof ApiError ? t(error.code, error.values) : t('UNKNOWN');
}

export async function fetchJson(url: string, fallback: ApiErrorCode, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError('NETWORK_ERROR');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw readApiError(body, fallback);
  return body;
}
