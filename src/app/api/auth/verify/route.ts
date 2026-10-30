import { verifyOtpRequest } from "@/lib/auth/otp";
import { privateJson, securityFailure } from "@/lib/security/http";

export async function POST(request: Request) {
  try { return privateJson(await verifyOtpRequest(request)); }
  catch (error) { return securityFailure(error); }
}
