"use client";

import {useState, type FormEvent} from "react";
import {useTranslations} from "next-intl";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {ApiError, fetchJson} from "@/lib/api/errors";

export function PreviewPasswordLogin({onSuccess}: {onSuccess: () => Promise<void>}) {
  const t = useTranslations("PreviewLogin");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const result = await fetchJson("/api/auth/preview-login", "PREVIEW_LOGIN_FAILED", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({phone, password}), cache: "no-store",
      });
      if (!result || typeof result !== "object" || !("success" in result) || result.success !== true) throw new ApiError("PREVIEW_LOGIN_FAILED");
      setPassword("");
      await onSuccess();
    } catch {
      setPassword("");
      setFailed(true);
    } finally { setPending(false); }
  }

  return <details className="mt-5 border-t border-border pt-4">
    <summary className="cursor-pointer rounded-lg py-2 text-sm font-semibold text-foreground">{t("title")}</summary>
    <p className="my-3 text-sm text-muted-foreground">{t("description")}</p>
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="preview-phone">{t("phone")}</Label>
        <Input id="preview-phone" name="preview-phone" type="tel" autoComplete="username" dir="ltr" required maxLength={64} value={phone} onChange={event => setPhone(event.target.value)} disabled={pending} />
      </div>
      <div className="space-y-2"><Label htmlFor="preview-password">{t("password")}</Label>
        <Input id="preview-password" name="preview-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
      </div>
      {failed && <p role="alert" className="text-sm text-destructive">{t("failed")}</p>}
      <Button type="submit" className="w-full" pending={pending} pendingLabel={t("pending")}>{t("submit")}</Button>
    </form>
  </details>;
}
