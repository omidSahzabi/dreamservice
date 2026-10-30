"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { usernameSchema } from "@/lib/account/identity";
import { ApiError, fetchJson, localizeApiError, readApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";

export function UsernameAvailability({ username, disabled = false }: { username: string; disabled?: boolean }) {
  const t = useTranslations("Account");
  const errors = useTranslations("Errors");
  const query = useMutation({ mutationFn: async (value: string) => {
    const parsed = usernameSchema.safeParse(value);
    if (!parsed.success) throw readApiError({ code: parsed.error.issues[0]?.message }, "USERNAME_INVALID");
    const result = z.object({ available: z.boolean() }).safeParse(await fetchJson("/api/account/username?username=" + encodeURIComponent(parsed.data), "UNKNOWN", { cache: "no-store" }));
    if (!result.success) throw new ApiError("UNKNOWN");
    return result.data.available;
  } });
  return <div className="space-y-2"><Button type="button" size="sm" variant="outline" disabled={disabled || !username.trim()} pending={query.isPending} pendingLabel={t("checking")} onClick={() => query.mutate(username)}>{t("checkAvailability")}</Button>
    {query.variables === username && <p role="status" className="text-sm text-muted-foreground">{query.isError ? localizeApiError(query.error, errors) : query.isSuccess ? t(query.data ? "available" : "taken") : null}</p>}
  </div>;
}
