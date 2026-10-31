"use client";

import {useState, type FormEvent} from "react";
import {useTranslations} from "next-intl";
import {useQueryClient} from "@tanstack/react-query";
import {useRouter} from "@/lib/i18n/navigation";
import {clearSensitiveState} from "@/lib/auth/client-state";
import {ApiError, fetchJson} from "@/lib/api/errors";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";

export function TemporaryAdminLogin() {
  const t = useTranslations("TemporaryAdminLogin");
  const router = useRouter();
  const client = useQueryClient();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setFailed(false);
    try {
      const result = await fetchJson("/api/auth/temporary-admin-login", "TEMP_ADMIN_LOGIN_FAILED", {
        method: "POST", headers: {"Content-Type": "application/json"}, cache: "no-store", body: JSON.stringify({phone, password}),
      });
      if (!result || typeof result !== "object" || !("success" in result) || result.success !== true) throw new ApiError("TEMP_ADMIN_LOGIN_FAILED");
      setPassword("");
      await clearSensitiveState(client);
      await client.invalidateQueries({queryKey: ["authUser"]});
      router.replace("/admin/projects");
      router.refresh();
    } catch { setPassword(""); setFailed(true); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    <div className="space-y-2"><Label htmlFor="temporary-admin-phone">{t("phone")}</Label>
      <Input id="temporary-admin-phone" name="phone" type="tel" inputMode="tel" autoComplete="username" dir="ltr" required maxLength={64} value={phone} onChange={event => setPhone(event.target.value)} disabled={pending} />
    </div>
    <div className="space-y-2"><Label htmlFor="temporary-admin-password">{t("password")}</Label>
      <Input id="temporary-admin-password" name="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
    </div>
    {failed && <p role="alert" className="text-sm text-destructive">{t("failed")}</p>}
    <Button type="submit" className="w-full" pending={pending} pendingLabel={t("pending")}>{t("submit")}</Button>
  </form>;
}
