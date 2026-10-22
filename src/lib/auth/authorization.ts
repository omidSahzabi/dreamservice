import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SecurityError, securityEvent } from "@/lib/security/http";

export const ADMIN_ROLE = "app-admin";
export type Principal = { id: string; permission: "CUSTOMER" | "ADMIN" };

export async function getAuthenticatedPrincipal(): Promise<Principal | null> {
  try {
    const user = await getCurrentUser();
    return user ? { id: user.id, permission: user.roles.includes(ADMIN_ROLE) ? "ADMIN" : "CUSTOMER" } : null;
  } catch (error) {
    unstable_rethrow(error);
    securityEvent("operation_failed");
    throw new SecurityError(503, "UNKNOWN");
  }
}

export async function requireAuth() {
  const principal = await getAuthenticatedPrincipal();
  if (!principal) throw new SecurityError(401, "UNAUTHENTICATED");
  return principal;
}

export async function requireRole(permission: Principal["permission"]) {
  const principal = await requireAuth();
  if (principal.permission !== permission) throw new SecurityError(403, "FORBIDDEN");
  return principal;
}

export const requireAdmin = () => requireRole("ADMIN");
export function requireOwnership(principal: Principal, ownerId: string) {
  if (principal.permission !== "ADMIN" && principal.id !== ownerId) throw new SecurityError(404, "NOT_FOUND");
}
