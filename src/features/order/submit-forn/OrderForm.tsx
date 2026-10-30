"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOrderFormConfig, useSubmitOrder } from "@/hooks/useOrderForm";
import { createFormSchema, createStepSchema } from "@/schemas/orderSchema";
import { useOrderStore } from "@/store/orderStore";
import type { OrderFormConfig, OrderFormData } from "@/types/order";

import {localizeApiError} from "@/lib/api/errors";
import {ApiError} from "@/lib/api/errors";

import { StepRenderer } from "./StepRenderer";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@/lib/i18n/navigation";
import { AccessRequired } from "@/components/modules/auth/AccessRequired";
import {OrderReceipt} from "./OrderReceipt";
import {ContentSkeleton} from "@/components/ui/content-skeleton";

export function OrderForm() {
  const {user, isLoading: authLoading, isError: authFailed} = useAuth();
  const t = useTranslations("OrderForm");
  const locale = useLocale();
  const errors = useTranslations("Errors");


  const {
    data: config,
    isLoading,
    isError,
    error,
    refetch,
  } = useOrderFormConfig(locale);

  const isRtl = locale === "fa";

  if (authFailed || (!authLoading && !user)) return <AccessRequired />;

  if (isLoading || authLoading) {
    return (
      <main
        dir={isRtl ? "rtl" : "ltr"}
        className="mx-auto min-h-[60vh] max-w-5xl bg-bg-primary p-4 sm:p-8"
      >
        <ContentSkeleton layout="form" label={t("loading")} />
      </main>
    );
  }

  if (isError || !config) {
    return (
      <main
        dir={isRtl ? "rtl" : "ltr"}
        className="flex min-h-screen items-center justify-center bg-bg-primary p-4"
      >
        <div role="alert" className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-destructive/20 bg-bg-secondary/60 p-8 text-center shadow-xl">
          <p className="text-sm font-medium text-destructive">
            {error ? localizeApiError(error, errors) : t("loadError")}
          </p>

          <Button
            onClick={() => refetch()}
            variant="outline"
            className="gap-2 rounded-xl border-border-soft hover:bg-primary/5"
          >
            <RefreshCw className="size-4" />
            <span>{t("retry")}</span>
          </Button>
        </div>
      </main>
    );
  }

  if (!user) return <AccessRequired />;
  return <OrderFormWizardContent key={user.id} config={config} />;
}

function OrderFormWizardContent({ config }: { config: OrderFormConfig }) {
  const format = useFormatter();

  const t = useTranslations("OrderForm");
  const locale = useLocale();
  const errors = useTranslations("Errors");


  const currentStep = useOrderStore((state) => state.currentStep);
  const updateFormData = useOrderStore((state) => state.updateFormData);
  const resetForm = useOrderStore((state) => state.resetForm);
  const initialData = useOrderStore((state) => state.formData);

  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null);
  const [submittedOrderId, setSubmittedOrderId] = useState<number | null>(null);
  const submissionLock = useRef(false);
  const focusField = useRef<string | null>(null);

  const submitMutation = useSubmitOrder();

  const { steps, settings, title, description, key } = config.form;
  const totalSteps = steps.length;
  const activeStep = Math.min(currentStep, totalSteps - 1);
  const step = steps[activeStep];

  const methods = useForm<OrderFormData>({
    defaultValues: {
      ...Object.fromEntries(steps.flatMap(step => step.fields.filter(field => field.defaultValue != null).map(field => [field.id, field.defaultValue ?? undefined]))),
      ...initialData
    },
    mode: "onTouched",
    resolver: (values, context, options) => zodResolver(createFormSchema(steps, values, t))(values, context, options),
  });

  const { trigger, getValues, handleSubmit, subscribe, setFocus } = methods;
  useEffect(() => subscribe({formState: {values: true}, callback: ({values}) => updateFormData(values)}), [subscribe, updateFormData]);
  useEffect(() => {
    if (focusField.current) {
      setFocus(focusField.current);
      focusField.current = null;
    }
  }, [activeStep, setFocus]);

  if (!step) return <p role="status">{t("empty")}</p>;

  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === totalSteps - 1;
  const progress = ((activeStep + 1) / totalSteps) * 100;
  const isRtl = locale === "fa";

  const handleNext = async () => {
    const currentValues = getValues();

    const stepValidation = createStepSchema(
      step,
      currentValues,
      t,
      steps,
    ).safeParse(currentValues);

    if (!stepValidation.success) {
      await trigger(step.fields.map((field) => field.id), {shouldFocus: true});
      return;
    }

    updateFormData(currentValues);
    useOrderStore.getState().setStep(activeStep + 1);
  };

  const handlePrev = () => {
    updateFormData(getValues());
    useOrderStore.getState().setStep(activeStep - 1);
  };

  const onFinalSubmit = async (data: OrderFormData) => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setSubmitError(null);
    updateFormData(data);

    try {
      const result = await submitMutation.mutateAsync({
        formKey: key,
        data,
      });

      setSubmittedOrderId(result.order_id);
      resetForm();
    } catch (err: unknown) {
      submissionLock.current = false;
      if (err instanceof Error) {
        setSubmitError(err);
      } else {
        setSubmitError(new Error("UNKNOWN"));
      }
    }
  };

  if (submittedOrderId !== null) {
    return <OrderReceipt orderId={submittedOrderId} />;
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={event => {
          if (!isLastStep) {event.preventDefault(); void handleNext(); return;}
          void handleSubmit(onFinalSubmit, fieldErrors => {
            const index = steps.findIndex(item => item.fields.some(field => fieldErrors[field.id]));
            const field = steps[index]?.fields.find(item => fieldErrors[item.id]);
            if (field) {
              if (index === activeStep) setFocus(field.id);
              else {focusField.current = field.id; useOrderStore.getState().setStep(index);}
            }
          })(event);
        }}
        aria-busy={submitMutation.isPending}
        dir={isRtl ? "rtl" : "ltr"}
        noValidate
      >
        <fieldset disabled={submitMutation.isPending} className="min-w-0 border-0 p-0">
        <main className="ds-content-reveal min-h-screen bg-background px-4 py-8 selection:bg-primary/20 selection:text-primary sm:py-12 lg:py-16">
          <div className="mx-auto w-full max-w-2xl">
            <header className="mb-8 text-center sm:mb-10">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur-md">
                <Sparkles className="size-3.5" />
                <span>{t("badge")}</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl lg:text-4xl">
                {title}
              </h1>

              {description && (
                <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-text-secondary sm:text-base">
                  {description}
                </p>
              )}
            </header>

            <div className="overflow-hidden rounded-2xl border border-border-soft/80 bg-card shadow-soft">
              {settings.showProgress && (
                <div className="border-b border-border-soft/60 bg-bg-secondary/30 p-5 sm:p-6">
                  <div className="mb-6 flex items-center justify-between">
                    {steps.map((item, index) => {
                      const isActive = index === currentStep;
                      const isCompleted = index < currentStep;

                      return (
                        <div
                          key={item.id}
                          className="flex min-w-0 flex-1 items-center"
                        >
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all duration-300 sm:size-10 ${
                                isCompleted
                                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                  : isActive
                                    ? "border-2 border-primary bg-primary/10 text-primary ring-4 ring-primary/15"
                                    : "border border-border-soft bg-bg-primary text-text-muted"
                              }`}
                            >
                              {isCompleted ? (
                                <Check className="size-4" strokeWidth={3} />
                              ) : (
                                format.number(index + 1)
                              )}
                            </div>

                            <span
                              className={`mt-2 hidden max-w-20 truncate text-center text-[11px] sm:block ${
                                isActive
                                  ? "font-semibold text-primary"
                                  : isCompleted
                                    ? "text-text-primary"
                                    : "text-text-muted"
                              }`}
                            >
                              {item.title}
                            </span>
                          </div>

                          {index < totalSteps - 1 && (
                            <div className="mx-2 mt-[-1.25rem] h-0.5 flex-1 rounded-full bg-border-soft sm:mx-3">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{
                                  width: index < currentStep ? "100%" : "0%",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text-secondary">
                        {t("stepProgress", {
                          current: activeStep + 1,
                          total: totalSteps,
                        })}
                      </span>

                      <span className="font-bold text-primary">
                        {format.number(progress / 100, {style: "percent", maximumFractionDigits: 0})}
                      </span>
                    </div>

                    <Progress
                      value={progress}
                      className="h-2 bg-border-soft/60"
                    />
                  </div>
                </div>
              )}

              <section className="p-6 sm:p-8">
                {submitError && (
                  <div role="alert" className="mb-6 space-y-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
                    {localizeApiError(submitError, errors)}
                    {submitError instanceof ApiError && submitError.code === "ORDER_OPEN_EXISTS" && Number.isSafeInteger(submitError.values.orderId) && submitError.values.orderId > 0 && <Link className="block underline" href={`/order?orderId=${submitError.values.orderId}`}>{t("viewExistingOrder")}</Link>}
                  </div>
                )}

                <StepRenderer step={step} steps={steps} />
              </section>

              <div className="border-t border-border-soft/60 bg-bg-secondary/40 px-6 py-4 sm:px-8 sm:py-5">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      isFirstStep ||
                      !settings.allowBack ||
                      submitMutation.isPending
                    }
                    onClick={handlePrev}
                    className="h-11 gap-2 rounded-xl border-border-soft bg-bg-primary px-5 font-medium text-text-secondary hover:border-primary/40 hover:bg-primary/5 hover:text-text-primary disabled:opacity-40"
                  >
                    {isRtl ? (
                      <ArrowRight className="size-4" />
                    ) : (
                      <ArrowLeft className="size-4" />
                    )}

                    <span>{t("previous")}</span>
                  </Button>

                  {isLastStep ? (
                    <Button
                      type="submit"
                      pending={submitMutation.isPending}
                      pendingLabel={t("submitting")}
                      className="h-11 gap-2 rounded-xl bg-primary px-7 font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover disabled:opacity-50"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <span>{t("submitting")}</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {settings.submitButtonText || t("submit")}
                          </span>
                          <Check className="size-4" strokeWidth={2.5} />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="h-11 gap-2 rounded-xl bg-primary px-7 font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover"
                    >
                      <span>{t("next")}</span>

                      {isRtl ? (
                        <ArrowLeft className="size-4" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <footer className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-text-muted">
              <ShieldCheck className="size-4 text-emerald-500" />

              <span>{t("privacyNotice")}</span>
            </footer>
          </div>
        </main>
        </fieldset>
      </form>
    </FormProvider>
  );
}
