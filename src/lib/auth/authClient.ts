import {z} from 'zod';
import {ApiError, fetchJson} from '@/lib/api/errors';

const userSchema = z.object({
  id: z.string(), fname: z.string().nullable(), lname: z.string().nullable(),
  contact: z.string().nullable(), email: z.string().nullable(), roles: z.array(z.string()),
  permission: z.enum(['CUSTOMER', 'ADMIN'])
});
export type UserResponse = z.infer<typeof userSchema>;

export async function getMe(): Promise<UserResponse | null> {
  const data = z.object({success: z.boolean(), user: userSchema.nullable()})
    .safeParse(await fetchJson('/api/auth/me', 'UNKNOWN', {cache: 'no-store'}));
  if (!data.success) throw new ApiError('UNKNOWN');
  return data.data.success ? data.data.user : null;
}

const post = (body: unknown) => ({
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
});

const deliverySchema = z.enum(['PENDING', 'ACCEPTED', 'UNKNOWN', 'FAILED', 'EXPIRED', 'USED', 'LOCKED']);
const challengeSchema = z.object({success: z.literal(true), delivery: deliverySchema, expiresAt: z.iso.datetime(), serverNow: z.iso.datetime()});
export type OtpDelivery = z.infer<typeof deliverySchema>;

export async function sendOtp(target: string) {
  const data = challengeSchema.extend({retryAfter: z.number(), expiresIn: z.number()})
    .safeParse(await fetchJson('/api/auth/send-otp', 'UNKNOWN', post({target})));
  if (!data.success) throw new ApiError('UNKNOWN');
  return data.data;
}

export async function getOtpStatus(target: string) {
  const data = challengeSchema.safeParse(await fetchJson('/api/auth/otp-status', 'UNKNOWN', {...post({target}), cache: 'no-store'}));
  if (!data.success) throw new ApiError('UNKNOWN');
  return data.data;
}

export async function verifyOtp(target: string, code: string) {
  const data = z.object({success: z.literal(true), isNewUser: z.boolean()})
    .safeParse(await fetchJson('/api/auth/verify', 'UNKNOWN', post({target, code})));
  if (!data.success) throw new ApiError('UNKNOWN');
  return data.data;
}

export async function registerUser(payload: {contact: string; fname: string; lname: string; email?: string; username?: string}) {
  const data = z.object({success: z.literal(true)})
    .safeParse(await fetchJson('/api/auth/register', 'REGISTER_FAILED', post(payload)));
  if (!data.success) throw new ApiError('REGISTER_FAILED');
  return data.data;
}

export async function logoutUser() {
  const data = z.object({success: z.literal(true)})
    .safeParse(await fetchJson('/api/auth/logout', 'LOGOUT_FAILED', {method: 'POST'}));
  if (!data.success) throw new ApiError('LOGOUT_FAILED');
  return data.data;
}
