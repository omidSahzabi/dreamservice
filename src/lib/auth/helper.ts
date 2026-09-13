import crypto from "crypto";

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) {
    throw new Error("شماره موبایل الزامی است.");
  }

  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("989")) {
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
  return Math.floor(10000 + Math.random() * 90000).toString();
}


export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
