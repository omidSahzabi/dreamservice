export interface UserResponse {
  id: string;
  fname: string | null;
  lname: string | null;
  contact: string | null;
  email: string | null;
  roles: string[];
}

export async function getMe(): Promise<UserResponse | null> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.success ? data.user : null;
}

export async function sendOtp(target: string) {
  const res = await fetch("/api/auth/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطا در ارسال کد تایید");
  return data;
}

export async function verifyOtp(target: string, code: string) {
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "کد وارد شده نامعتبر است");
  return data;
}

export async function registerUser(payload: {
  contact: string;
  fname: string;
  lname: string;
  email?: string;
}) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطا در ثبت نام");
  return data;
}

export async function logoutUser() {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطا در خروج");
  return data;
}
