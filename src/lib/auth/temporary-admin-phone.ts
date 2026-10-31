import "server-only";
import {normalizePhone} from "@/lib/auth/helper";
import {digest} from "@/lib/security/crypto";

// Pins the owner's single approved identity without publishing its phone number.
// This digest is an identity restriction, not a secret or password verifier.
const approvedPhoneDigest = "05ee37e92d20534378a654e885b27834746b7f6a459fdb9b708a47fa0f98a9b5";

export function isTemporaryAdminPhone(value: string): boolean {
  try { return digest(normalizePhone(value)) === approvedPhoneDigest; }
  catch { return false; }
}
