"use client";
import type { QueryClient } from "@tanstack/react-query";
import { useOrderStore } from "@/store/orderStore";
import { useUserStore } from "@/store/userStore";

export async function clearSensitiveState(client: QueryClient) {
  const predicate = (query: { queryKey: readonly unknown[] }) => ["orders", "order-history"].includes(String(query.queryKey[0]));
  // Start cancellation before removing caches; aborted fetches cannot repopulate them.
  const cancelled = client.cancelQueries({ predicate });
  client.removeQueries({ predicate });
  useOrderStore.getState().resetForm();
  useUserStore.getState().setActiveRole(null);
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem("order-form-storage"); } catch { /* Storage can be unavailable. */ }
  }
  await cancelled;
}
