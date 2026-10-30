import "server-only";
import crypto from "crypto";

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) {
    throw new Error("شماره موبایل الزامی است.");
  }

  const normalizedDigits = phone
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    )
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    );

  // Accept only explicit formatting, never discard arbitrary input characters.
  // Keep this contract in sync with entity.canonical_iran_mobile in the pending
  // account identity migration and the shared normalization regression cases.
  const formatted = normalizedDigits.replace(/ /g, "");
  const unwrapped = formatted.replace(/\(([0-9]+)\)/g, "$1");
  if (/[^+0-9-]/.test(unwrapped) || !/^\+?[0-9]+(?:-[0-9]+)*$/.test(unwrapped)) {
    throw new Error("شماره موبایل وارد شده معتبر نیست.");
  }

  const digits = unwrapped.replace(/[+-]/g, "");
  // Full structure determines the format: a ten-digit 98... is national.
  // An explicit '+' is valid only with the international 98 + mobile form.
  if (formatted.startsWith("+")) {
    if (/^989[0-9]{9}$/.test(digits)) return "0" + digits.slice(2);
  } else {
    if (/^9[0-9]{9}$/.test(digits)) return "0" + digits;
    if (/^09[0-9]{9}$/.test(digits)) return digits;
    if (/^989[0-9]{9}$/.test(digits)) return "0" + digits.slice(2);
    if (/^00989[0-9]{9}$/.test(digits)) return "0" + digits.slice(4);
  }

  throw new Error("شماره موبایل وارد شده معتبر نیست.");
}


export function normalizeEmail(email: string): string {
  const cleaned = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(cleaned)) {
    throw new Error("آدرس ایمیل وارد شده معتبر نیست.");
  }
  
  return cleaned;
}

export function generateOtpCode(): string {
  return crypto.randomInt(10000, 100000).toString();
}
