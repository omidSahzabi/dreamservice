"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthModalStore } from "@/store/authModalStore";
import { sendOtp, verifyOtp, registerUser, getOtpStatus, type OtpDelivery } from "@/lib/auth/authClient";
import { otpDeadline, otpSeconds } from "@/lib/auth/otp-clock";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { ApiError, localizeApiError, readApiError } from "@/lib/api/errors";
import { normalizeDigits } from "@/lib/i18n/digits";
import { clearSensitiveState } from "@/lib/auth/client-state";
import { useRouter } from "@/lib/i18n/navigation";
import { prohibitedIdentity, usernameSchema } from "@/lib/account/identity";
import { UsernameAvailability } from "./UsernameAvailability";
import {PreviewPasswordLogin} from "./PreviewPasswordLogin";

export function AuthModal({previewLoginEnabled = false}: {previewLoginEnabled?: boolean}) {
  const locale = useLocale();
  const errors = useTranslations("Errors");
  const t = useTranslations("AuthModal");

  const phoneSchema = useMemo(
    () =>
      z.object({
        phone: z
          .string()
          .transform(normalizeDigits)
          .pipe(z.string().min(10, t("validation.phoneMin"))
          .regex(/^09\d{9}$/, t("validation.phoneInvalid"))),
      }),
    [t]
  );

  const otpSchema = useMemo(
    () =>
      z.object({
        code: z.string().transform(normalizeDigits).pipe(z.string().regex(/^\d{5}$/, t("validation.otpLength"))),
      }),
    [t]
  );

  const registerSchema = useMemo(
    () =>
      z.object({
        fname: z.string().min(2, t("validation.firstNameMin")).refine(value => !prohibitedIdentity(value), errors("NAME_PROHIBITED")),
        lname: z.string().min(2, t("validation.lastNameMin")).refine(value => !prohibitedIdentity(value), errors("NAME_PROHIBITED")),
        username: z.string().superRefine((value, context) => {
          if (!value) return;
          const result = usernameSchema.safeParse(value);
          if (!result.success) context.addIssue({ code: "custom", message: errors(readApiError({ code: result.error.issues[0]?.message }, "USERNAME_INVALID").code) });
        }),
        email: z.string().email(t("validation.emailInvalid")).optional().or(z.literal("")),
      }),
    [t, errors]
  );

  type PhoneFormValues = z.infer<typeof phoneSchema>;
  type OtpFormValues = z.infer<typeof otpSchema>;
  type RegisterFormValues = z.infer<typeof registerSchema>;

  const {
    isOpen,
    step,
    phone,
    resendCooldown,
    onSuccessCallback,
    returnFocusTo,
    closeAuthModal,
    setStep,
    setPhone,
    setResendCooldown,
  } = useAuthModalStore();

  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [delivery, setDelivery] = useState<OtpDelivery | "PREPARING">("PREPARING");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const retryAt = useRef(0);
  const generation = useRef(0);
  const requestLock = useRef(false);
  const windowOpen = deadline !== null && remaining > 0;

  useEffect(() => {
    const tick = () => {
      setRemaining(otpSeconds(deadline, performance.now()));
      setResendCooldown(otpSeconds(retryAt.current, performance.now()));
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [deadline, setResendCooldown]);

  useEffect(() => () => { generation.current++; }, []);

  const closeModal = () => {
    generation.current++;
    setDeadline(null);
    setIsRequesting(false);
    requestLock.current = false;
    retryAt.current = 0;
    closeAuthModal();
  };

  useEffect(() => {
    if (!isOpen || step !== "OTP" || isRequesting || !windowOpen ||
        ["FAILED", "USED", "LOCKED", "EXPIRED"].includes(delivery)) return;
    let cancelled = false;
    const current = generation.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const started = performance.now();
      try {
        const status = await getOtpStatus(phone);
        if (cancelled || current !== generation.current) return;
        setDelivery(status.delivery);
        setDeadline(previous => Math.min(previous ?? Infinity, otpDeadline(status.expiresAt, status.serverNow, started)));
      } catch {
        // A status transport failure is not proof of delivery failure.
        if (!cancelled && current === generation.current) setDelivery("UNKNOWN");
      }
      if (!cancelled && current === generation.current) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isOpen, step, phone, isRequesting, windowOpen, delivery]);

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fname: "", lname: "", email: "", username: "" },
  });
  const chosenUsername = useWatch({ control: registerForm.control, name: "username" });
  const resetPhone = phoneForm.reset;
  const resetOtp = otpForm.reset;
  const resetRegistration = registerForm.reset;
  useEffect(() => {
    if (!isOpen) {
      resetPhone({phone: ""});
      resetOtp({code: ""});
      resetRegistration({fname: "", lname: "", email: "", username: ""});
    }
  }, [isOpen, resetPhone, resetOtp, resetRegistration]);

  const handleSendOtp = async (data: PhoneFormValues) => {
    if (requestLock.current) return;
    requestLock.current = true;
    const current = ++generation.current;
    const started = performance.now();
    setIsRequesting(true);
    setDeadline(null);
    setDelivery("PREPARING");
    resetOtp({code: ""});
    setPhone(data.phone);
    setStep("OTP");
    try {
      const res = await sendOtp(data.phone);
      if (current !== generation.current) return;
      setDeadline(otpDeadline(res.expiresAt, res.serverNow, started));
      retryAt.current = started + res.retryAfter * 1000;
      setResendCooldown(otpSeconds(retryAt.current, performance.now()));
      setDelivery(res.delivery);
    } catch (error: unknown) {
      if (current !== generation.current) return;
      // Recover only from an authorized cookie-bound challenge. A 502 or lost
      // response alone cannot establish one, nor claim that SMS was sent.
      if (error instanceof ApiError && ["NETWORK_ERROR", "SMS_FAILED"].includes(error.code)) {
        try {
          const recovered = await getOtpStatus(data.phone);
          if (current !== generation.current) return;
          setDeadline(otpDeadline(recovered.expiresAt, recovered.serverNow, started));
          setDelivery(recovered.delivery);
          retryAt.current = started + 60000;
          return;
        } catch { /* No authorized challenge was recovered. */ }
      }
      if (current !== generation.current) return;
      setStep("PHONE");
      toast.error(localizeApiError(error, errors));
    } finally {
      if (current === generation.current) {
        setIsRequesting(false);
        requestLock.current = false;
      }
    }
  };

  const handleVerifyOtp = async (data: OtpFormValues) => {
    try {
      setIsSubmitting(true);
      const res = await verifyOtp(phone, data.code);
      resetOtp({code: ""});
      if (res.isNewUser) {
        setStep("REGISTER");
      } else {
        await clearSensitiveState(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["authUser"] });
        router.refresh();
        if (onSuccessCallback) onSuccessCallback();
        closeModal();
        toast.success(t("toast.authSuccess"));
      }
    } catch (error: unknown) {
      toast.error(localizeApiError(error, errors));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (data: RegisterFormValues) => {
    try {
      setIsSubmitting(true);
      await registerUser({
        contact: phone,
        fname: data.fname,
        lname: data.lname,
        email: data.email || undefined,
        username: data.username || undefined,
      });
      await clearSensitiveState(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["authUser"] });
      router.refresh();
      if (onSuccessCallback) onSuccessCallback();
      closeModal();
      toast.success(t("toast.registerSuccess"));
    } catch (error: unknown) {
      toast.error(localizeApiError(error, errors));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent onCloseAutoFocus={event => {
        event.preventDefault();
        if (returnFocusTo?.isConnected) returnFocusTo.focus();
      }} dir={locale === "fa" ? "rtl" : "ltr"} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[420px] rounded-2xl bg-background border shadow-xl">
        <DialogHeader className="text-start">
          <DialogTitle className="text-xl font-bold">
            {step === "PHONE" && t("title.phone")}
            {step === "OTP" && t("title.otp")}
            {step === "REGISTER" && t("title.register")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {step === "PHONE" && t("description.phone")}
            {step === "OTP" && t.rich("description.otp", { phone, number: chunks => <bdi dir="ltr">{chunks}</bdi> })}
            {step === "REGISTER" && t("description.register")}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "PHONE" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <form noValidate onSubmit={event => { void phoneForm.handleSubmit(handleSendOtp)(event); }} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("label.phone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={t("placeholder.phone")}
                    dir="ltr"
                    className="text-left tracking-widest font-mono"
                    {...phoneForm.register("phone")}
                  />
                  {phoneForm.formState.errors.phone && (
                    <p className="text-xs text-destructive">
                      {phoneForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" pending={isSubmitting || isRequesting} pendingLabel={t("button.sending")}>
                  {t("button.sendOtp")}
                </Button>
              </form>
              {previewLoginEnabled && <PreviewPasswordLogin onSuccess={async () => {
                await clearSensitiveState(queryClient);
                await queryClient.invalidateQueries({queryKey: ["authUser"]});
                router.refresh();
                if (onSuccessCallback) onSuccessCallback();
                closeModal();
                toast.success(t("toast.authSuccess"));
              }} />}
            </motion.div>
          )}

          {step === "OTP" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <form noValidate onSubmit={event => { void otpForm.handleSubmit(handleVerifyOtp)(event); }} className="space-y-4 pt-2">
                <p role="status" className="text-sm text-muted-foreground">
                  {t(`delivery.${deadline !== null && remaining <= 0 ? "EXPIRED" : delivery}`)}
                </p>
                {deadline !== null && <p className="text-sm tabular-nums">{t("verificationCountdown", {seconds: remaining})}</p>}
                <div className="space-y-2">
                  <Label htmlFor="code">{t("label.otp")}</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t("placeholder.otp")}
                    maxLength={5}
                    dir="ltr"
                    className="text-center text-lg tracking-[0.5em] font-mono"
                    {...otpForm.register("code")}
                  />
                  {otpForm.formState.errors.code && (
                    <p className="text-xs text-destructive">
                      {otpForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setStep("PHONE")}
                    disabled={isSubmitting || isRequesting}
                      className="text-primary underline cursor-pointer"
                  >
                    {t("action.changePhone")}
                  </button>
                  {resendCooldown > 0 ? (
                    <span>{t("action.resendCountdown", { seconds: resendCooldown })}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp({ phone })}
                      disabled={isSubmitting || isRequesting}
                      aria-busy={isSubmitting || isRequesting || undefined}
                      className="text-primary underline cursor-pointer"
                    >
                      {t("action.resendOtp")}
                    </button>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isRequesting || deadline === null || remaining <= 0 || ["FAILED", "USED", "LOCKED"].includes(delivery)} pending={isSubmitting} pendingLabel={t("button.verifying")}>
                  {t("button.verify")}
                </Button>
              </form>
            </motion.div>
          )}

          {step === "REGISTER" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <form noValidate onSubmit={event => { void registerForm.handleSubmit(handleRegister)(event); }} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="fname">{t("label.firstName")}</Label>
                  <Input
                    id="fname"
                    placeholder={t("placeholder.firstName")}
                    {...registerForm.register("fname")}
                  />
                  {registerForm.formState.errors.fname && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.fname.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lname">{t("label.lastName")}</Label>
                  <Input
                    id="lname"
                    placeholder={t("placeholder.lastName")}
                    {...registerForm.register("lname")}
                  />
                  {registerForm.formState.errors.lname && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.lname.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("label.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("placeholder.email")}
                    dir="ltr"
                    className="text-left"
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2"><Label htmlFor="registration-username">{t("label.username")}</Label><Input id="registration-username" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30} {...registerForm.register("username")} />
                  <p className="text-xs text-muted-foreground">{t("usernameHint")}</p>
                  {registerForm.formState.errors.username && <p role="alert" className="text-xs text-destructive">{registerForm.formState.errors.username.message}</p>}
                  <UsernameAvailability username={chosenUsername} disabled={isSubmitting} />
                </div>
                <Button type="submit" className="w-full" pending={isSubmitting} pendingLabel={t("button.registering")}>
                  {t("button.register")}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
