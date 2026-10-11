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

  let cleaned = normalizedDigits.replace(/\D/g, "");

  if (cleaned.startsWith("0098")) {
    cleaned = "0" + cleaned.slice(4);
  } else if (cleaned.startsWith("98")) {
    cleaned = "0" + cleaned.slice(2);
  } else if (cleaned.startsWith("9") && cleaned.length === 10) {
    cleaned = "0" + cleaned;
  }

  if (!/^09\d{9}$/.test(cleaned)) {
    throw new Error("شماره موبایل وارد شده معتبر نیست.");
  }

  return cleaned;
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

export function hashOtpCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}

