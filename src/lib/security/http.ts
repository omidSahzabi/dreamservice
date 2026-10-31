import "server-only";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";
import { SecurityConfigurationError } from "@/lib/security/crypto";
import type { ApiErrorCode } from "@/lib/api/errors";

export class SecurityError extends Error {
  constructor(public status: number, public code: ApiErrorCode, public retryAfter?: number) {
    super(code);
  }
}

export async function otpOperation<T>(operation: string, run: () => T | Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    if (process.env.NODE_ENV === "development" && !(error instanceof SecurityError)) {
      const category = error instanceof SecurityConfigurationError ? "security_otp_key_missing_or_short" :
        error instanceof Prisma.PrismaClientInitializationError ? "database_initialization" :
        error instanceof Prisma.PrismaClientKnownRequestError ? "database_query" :
        error instanceof Prisma.PrismaClientValidationError ? "prisma_validation" : "unexpected";
      const code = error instanceof Prisma.PrismaClientKnownRequestError && /^P\d{4}$/.test(error.code) ? error.code : undefined;
      // Never log exception messages, stacks, query parameters, or request data.
      console.warn(JSON.stringify({ event: "otp_operation_failed", operation, category, ...(code ? { code } : {}) }));
    }
    throw error;
  }
}

export function securityEvent(event: "auth_denied" | "auth_succeeded" | "temporary_admin_login_succeeded" | "role_denied" | "rate_limited" | "operation_failed" | "sms_failed", code?: ApiErrorCode) {
  // Intentionally excludes identifiers, inputs, exception objects and credentials.
  console.warn(JSON.stringify({ event, ...(code ? { code } : {}), at: new Date().toISOString() }));
}

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
}

export function securityFailure(error: unknown, fallback: ApiErrorCode = "UNKNOWN") {
  unstable_rethrow(error);
  if (error instanceof SecurityError) {
    if (error.status === 401 || error.code.startsWith("OTP_")) securityEvent("auth_denied", error.code);
    if (error.status === 403) securityEvent("role_denied", error.code);
    const response = privateJson({ success: false, code: error.code, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) }, error.status);
    if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
  securityEvent("operation_failed");
  return privateJson({ success: false, code: fallback }, 500);
}

export function validateMutation(request: Request, json = true) {
  const expected = process.env.SECURITY_ORIGIN ?? (process.env.NODE_ENV !== "production" ? new URL(request.url).origin : undefined);
  if (!expected || request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new SecurityError(403, "FORBIDDEN");
  }
  if (json && request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new SecurityError(415, "INVALID_INPUT");
  }
}

export async function readJson(request: Request, maxBytes = 65536): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new SecurityError(413, "INVALID_INPUT");
  if (!request.body) throw new SecurityError(400, "INVALID_INPUT");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new SecurityError(413, "INVALID_INPUT");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    throw new SecurityError(400, "INVALID_INPUT");
  } finally {
    reader.releaseLock();
  }
}
