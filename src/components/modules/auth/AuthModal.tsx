"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthModalStore } from "@/store/authModalStore";
import { sendOtp, verifyOtp, registerUser } from "@/lib/auth/authClient";
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

import { localizeApiError } from "@/lib/api/errors";
import { normalizeDigits } from "@/lib/i18n/digits";

export function AuthModal() {
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
        fname: z.string().min(2, t("validation.firstNameMin")),
        lname: z.string().min(2, t("validation.lastNameMin")),
        email: z.string().email(t("validation.emailInvalid")).optional().or(z.literal("")),
      }),
    [t]
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
    closeAuthModal,
    setStep,
    setPhone,
    setResendCooldown,
  } = useAuthModalStore();

  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(resendCooldown - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown, setResendCooldown]);

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
    defaultValues: { fname: "", lname: "", email: "" },
  });

  const handleSendOtp = async (data: PhoneFormValues) => {
    try {
      setIsSubmitting(true);
      const res = await sendOtp(data.phone);
      setPhone(data.phone);
      setResendCooldown(res.retryAfter || 60);
      setStep("OTP");
      toast.success(t("toast.otpSent"));
    } catch (error: unknown) {
      toast.error(localizeApiError(error, errors));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (data: OtpFormValues) => {
    try {
      setIsSubmitting(true);
      const res = await verifyOtp(phone, data.code);
      if (res.isNewUser) {
        setStep("REGISTER");
      } else {
        await queryClient.invalidateQueries({ queryKey: ["authUser"] });
        if (onSuccessCallback) onSuccessCallback();
        closeAuthModal();
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
      });
      await queryClient.invalidateQueries({ queryKey: ["authUser"] });
      if (onSuccessCallback) onSuccessCallback();
      closeAuthModal();
      toast.success(t("toast.registerSuccess"));
    } catch (error: unknown) {
      toast.error(localizeApiError(error, errors));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent dir={locale === "fa" ? "rtl" : "ltr"} className="sm:max-w-[420px] rounded-2xl bg-background border shadow-xl">
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
              <form noValidate onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4 pt-2">
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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("button.sending") : t("button.sendOtp")}
                </Button>
              </form>
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
              <form noValidate onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4 pt-2">
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
                    disabled={isSubmitting}
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
                      className="text-primary underline cursor-pointer"
                    >
                      {t("action.resendOtp")}
                    </button>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("button.verifying") : t("button.verify")}
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
              <form noValidate onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4 pt-2">
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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("button.registering") : t("button.register")}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
