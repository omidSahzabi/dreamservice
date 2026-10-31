import "server-only";
import { z } from "zod";
import {getTranslations} from "next-intl/server";
import {normalizePhone} from "@/lib/auth/helper";

const accepted = z.object({
  meta: z.object({ status: z.literal(true), message_code: z.literal("200-1") }),
  data: z.object({ message_outbox_ids: z.array(z.number().int().positive()).min(1) }),
});
const otpReceipt = z.number().int().nonnegative();
const otpAccepted = z.object({status: z.literal("success"), data: otpReceipt});

function otpProviderFailure(category: "http_rejection" | "response_contract_mismatch" | "invalid_json" | "timeout_or_abort" | "request_failure" | "response_read_failure", diagnostics: {
  phase: "request" | "response";
  httpStatus?: number;
  statusIsSuccess?: boolean;
  dataValid?: boolean;
  dataType?: "missing" | "null" | "array" | "number" | "string" | "boolean" | "object" | "other";
}): {success: false} {
  // Only fixed categories, HTTP status, booleans and type names. Never log
  // response bodies, exception objects, receipt values or request/config data.
  console.warn(JSON.stringify({event: "otp_sms_provider_failed", category, ...diagnostics}));
  return {success: false};
}

export async function sendOtpSms({ to, code }: { to: string; code: string }): Promise<{ success: boolean }> {
  // No real delivery in development/tests and no fixed-code bypass.
  if (process.env.NODE_ENV !== "production" || process.env.SECURITY_SMS_ENABLED !== "true") return { success: false };
  const apiKey = process.env.FARAZSMS_API_KEY;
  const pattern = process.env.FARAZSMS_PATTERN_CODE;
  const sender = process.env.FARAZSMS_SENDER_NUMBER;
  if (!apiKey || !apiKey.trim() || /[\r\n]/.test(apiKey) || !pattern || /\s/.test(pattern) ||
      !sender || !/^[0-9]+$/.test(sender) || !/^[0-9]{5}$/.test(code)) return { success: false };
  let recipient: string;
  try { recipient = normalizePhone(to); } catch { return {success: false}; }
  let phase: "request" | "response" = "request";
  let httpStatus: number | undefined;
  try {
    // Contract: https://docs.iranpayamak.com/send-pattern-based-sms-13925177e0
    // The approved OTP pattern's attribute is "code", not the sample var1/var2.
    const response = await fetch("https://api.iranpayamak.com/ws/v1/sms/pattern", {
      method: "POST", signal: AbortSignal.timeout(10000), redirect: "error", cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json", "Api-Key": apiKey },
      body: JSON.stringify({ code: pattern, attributes: { code }, recipient, line_number: sender, number_format: "english" }),
    });
    phase = "response";
    httpStatus = response.status;
    if (!response.ok) return otpProviderFailure("http_rejection", {phase, httpStatus});
    const body: unknown = await response.json();
    if (!otpAccepted.safeParse(body).success) {
      const object = typeof body === "object" && body !== null && !Array.isArray(body) ? body : null;
      const statusIsSuccess = object !== null && "status" in object && object.status === "success";
      const data = object !== null && "data" in object ? object.data : undefined;
      const dataType = data === undefined ? "missing" : data === null ? "null" : Array.isArray(data) ? "array" :
        typeof data === "number" ? "number" : typeof data === "string" ? "string" : typeof data === "boolean" ? "boolean" : typeof data === "object" ? "object" : "other";
      return otpProviderFailure("response_contract_mismatch", {phase, httpStatus, statusIsSuccess, dataType, dataValid: otpReceipt.safeParse(data).success});
    }
    return {success: true};
  } catch (error) {
    const category = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "timeout_or_abort" :
      phase === "response" ? error instanceof SyntaxError ? "invalid_json" : "response_read_failure" : "request_failure";
    return otpProviderFailure(category, {phase, ...(httpStatus === undefined ? {} : {httpStatus})});
  }
}

export async function sendOrderStatusSms(to: string): Promise<"SENT" | "FAILED" | "UNKNOWN"> {
  if (process.env.OTP_DELIVERY_MODE === "console") {
    if (process.env.NODE_ENV !== "development") return "FAILED";
    const t = await getTranslations({locale: "fa", namespace: "OrderWorkflow"});
    // This console contains only the generic notification, never the admin message or destination.
    console.info("[development order notification] %s", t("sms"));
    return "SENT";
  }
  if (process.env.NODE_ENV !== "production" || process.env.SECURITY_SMS_ENABLED !== "true" || process.env.ORDER_NOTIFICATIONS_SMS_ENABLED !== "true") return "FAILED";
  const apiKey = process.env.FARAZSMS_API_KEY;
  const pattern = process.env.FARAZSMS_ORDER_STATUS_PATTERN_CODE;
  const sender = process.env.FARAZSMS_SENDER_NUMBER;
  if (!apiKey || !pattern || !sender || !/^\+98\d+$/.test(sender) || !/^09\d{9}$/.test(to)) return "FAILED";
  try {
    // A dedicated provider template contains only the generic status-change notice.
    const response = await fetch("https://edge.ippanel.com/v1/api/send", {
      method: "POST", signal: AbortSignal.timeout(10000), redirect: "error", cache: "no-store",
      headers: {"Content-Type": "application/json", Authorization: apiKey},
      body: JSON.stringify({sending_type: "pattern", from_number: sender, code: pattern, recipients: ["+98" + to.slice(1)], params: {}}),
    });
    const body: unknown = await response.json();
    if (response.ok && accepted.safeParse(body).success) return "SENT";
    // Only a definitive provider rejection is safe to retry. Ambiguous results require reconciliation.
    const rejected = z.object({meta: z.object({status: z.literal(false)})}).safeParse(body);
    return rejected.success ? "FAILED" : "UNKNOWN";
  } catch { return "UNKNOWN"; }
}
