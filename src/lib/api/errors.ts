export const errorCodes = [
  'PREVIEW_LOGIN_FAILED',
  'ORDER_OPEN_EXISTS', 'ORDER_RATE_LIMIT', 'REGISTRATION_CONFLICT', 'USERNAME_INVALID', 'USERNAME_RESERVED', 'USERNAME_TAKEN', 'NAME_PROHIBITED', 'ACCOUNT_PROFILE_UNAVAILABLE',
  'TICKET_CONFLICT', 'TICKET_CLOSED', 'TICKET_ORDER_INVALID', 'TICKET_TRANSITION_INVALID', 'TICKET_RATE_LIMIT',
  'PROJECT_CONFLICT', 'PROJECT_TRANSITION_INVALID', 'PROJECT_DEADLINE_INVALID', 'PROJECT_ORDER_NOT_FOUND',
  'ACCOUNT_BANNED', 'USER_SELF_ACTION', 'USER_LAST_ADMIN', 'USER_INELIGIBLE', 'USER_STATE_CONFLICT', 'MANAGEMENT_RATE_LIMIT',
  'UNKNOWN', 'NETWORK_ERROR', 'INVALID_INPUT', 'INVALID_PHONE',
  'OTP_EXPIRED', 'OTP_INVALID', 'OTP_NOT_FOUND', 'OTP_USED',
  'OTP_ATTEMPTS_EXCEEDED', 'OTP_RATE_LIMIT', 'SMS_FAILED',
  'REGISTRATION_EXPIRED', 'EMAIL_INVALID', 'REGISTER_FAILED',
  'UNAUTHENTICATED', 'FORBIDDEN', 'INVALID_ROLE', 'LOGOUT_FAILED',
  'ORDER_SUBMIT_FAILED', 'ORDER_LOAD_FAILED', 'ORDER_INVALID',
  'FORM_TRANSLATION_MISSING', 'FORM_NOT_FOUND', 'FORM_LOAD_FAILED',
  'NOT_FOUND', 'IDEMPOTENCY_CONFLICT', 'ORDER_STATUS_CONFLICT', 'ORDER_TRANSITION_INVALID', 'NOTIFICATION_RETRY_UNAVAILABLE'
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
  for (const [source, target] of [['retryAfter', 'seconds'], ['remainingAttempts', 'attempts'], ['orderId', 'orderId']] as const) {
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
