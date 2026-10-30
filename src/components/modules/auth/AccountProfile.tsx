"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { optionalUsernameSchema } from "@/lib/account/identity";
import { ApiError, fetchJson, localizeApiError, readApiError } from "@/lib/api/errors";
import { useAuth } from "@/hooks/useAuth";
import { AccessRequired } from "./AccessRequired";
import { UsernameAvailability } from "./UsernameAvailability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContentSkeleton } from "@/components/ui/content-skeleton";

const profileSchema = z.object({ username: z.string().nullable(), usernameSupported: z.boolean() });
export function AccountProfile({ actorId }: { actorId: string }) {
  const t = useTranslations("Account");
  const errors = useTranslations("Errors");
  const locale = useLocale();
  const auth = useAuth();
  const query = useQuery({ queryKey: ["account-profile", actorId, locale], enabled: auth.user?.id === actorId && !auth.isError, staleTime: 0,
    queryFn: async ({ signal }) => {
      const result = profileSchema.safeParse(await fetchJson("/api/account/profile", "UNKNOWN", { signal, cache: "no-store" }));
      if (!result.success) throw new ApiError("UNKNOWN");
      return result.data;
    } });
  if (auth.isLoading) return <ContentSkeleton layout="form" label={t("loading")} />;
  if (auth.isError || auth.user?.id !== actorId) return <AccessRequired embedded />;
  if (query.isPending) return <ContentSkeleton layout="form" label={t("loading")} />;
  if (query.isError) return <div role="alert"><p>{localizeApiError(query.error, errors)}</p><Button onClick={() => void query.refetch()}>{t("retry")}</Button></div>;
  return <ProfileForm key={actorId + (query.data.username ?? "")} profile={query.data} />;
}

function ProfileForm({ profile }: { profile: z.infer<typeof profileSchema> }) {
  const t = useTranslations("Account");
  const errors = useTranslations("Errors");
  const client = useQueryClient();
  const [username, setUsername] = useState(profile.username ?? "");
  const mutation = useMutation({ mutationFn: async () => {
    const parsed = optionalUsernameSchema.safeParse(username);
    if (!parsed.success) throw readApiError({ code: parsed.error.issues[0]?.message }, "USERNAME_INVALID");
    await fetchJson("/api/account/profile", "UNKNOWN", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: parsed.data }) });
  }, onSuccess: () => { toast.success(t("saved")); return client.invalidateQueries({ queryKey: ["account-profile"] }); } });
  return <form onSubmit={event => { event.preventDefault(); mutation.mutate(); }} className="space-y-5 rounded-2xl border border-border bg-card p-6">
    {!profile.usernameSupported && <p role="status">{errors("ACCOUNT_PROFILE_UNAVAILABLE")}</p>}
    <fieldset disabled={!profile.usernameSupported || mutation.isPending} className="space-y-4"><label htmlFor="account-username">{t("username")}</label>
      <Input id="account-username" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30} value={username} onChange={event => { setUsername(event.target.value); mutation.reset(); }} aria-describedby="username-hint" />
      <p id="username-hint" className="text-sm text-muted-foreground">{t("usernameHint")}</p><UsernameAvailability username={username} />
      <Button type="submit" pending={mutation.isPending} pendingLabel={t("saving")}>{t("save")}</Button>
    </fieldset>
    {mutation.isError && <p role="alert" className="text-destructive">{localizeApiError(mutation.error, errors)}</p>}
    {mutation.isSuccess && <p role="status">{t("saved")}</p>}
  </form>;
}
