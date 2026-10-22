import "server-only";
import { z } from "zod";
import {getTranslations} from "next-intl/server";

const accepted = z.object({
  meta: z.object({ status: z.literal(true), message_code: z.literal("200-1") }),
  data: z.object({ message_outbox_ids: z.array(z.number().int().positive()).min(1) }),
});

export async function sendOtpSms({ to, code }: { to: string; code: string }): Promise<{ success: boolean }> {
  // No real delivery in development/tests and no fixed-code bypass.
  if (process.env.NODE_ENV !== "production" || process.env.SECURITY_SMS_ENABLED !== "true") return { success: false };
  const apiKey = process.env.FARAZSMS_API_KEY;
  const pattern = process.env.FARAZSMS_PATTERN_CODE;
  const sender = process.env.FARAZSMS_SENDER_NUMBER;
  if (!apiKey || !pattern || !sender || !/^\+98\d+$/.test(sender) || !/^09\d{9}$/.test(to)) return { success: false };
  try {
    // Contract: https://ippanelcom.github.io/Edge-Document/docs/send/pattern/
    const response = await fetch("https://edge.ippanel.com/v1/api/send", {
      method: "POST", signal: AbortSignal.timeout(10000), redirect: "error", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ sending_type: "pattern", from_number: sender, code: pattern, recipients: ["+98" + to.slice(1)], params: { code } }),
    });
    return { success: response.ok && accepted.safeParse(await response.json()).success };
  } catch { return { success: false }; }
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
