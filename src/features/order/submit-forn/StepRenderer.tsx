"use client";

import { memo } from "react";
import { useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { getVisibleFields } from "@/schemas/orderSchema";
import type { FormStep, OrderFormData } from "@/types/order";
import { FieldRenderer } from "./FieldRenderer";
import { useTranslations } from "next-intl";

export const StepRenderer = memo(function StepRenderer({
  step,
  steps,
}: {
  step: FormStep;
  steps?: FormStep[];
}) {
  const t = useTranslations("OrderForm");
  const formValues = useWatch<OrderFormData>();
  const visibleFields = getVisibleFields(step, Object.fromEntries(Object.entries(formValues).map(([key, value]) => [key, Array.isArray(value) ? value.filter(item => typeof item === "string") : value])), steps);

  return (
    <div className="space-y-8">
      <div className="border-b border-border-soft/60 pb-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-primary">
            {t("requiredInformation")}
          </span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
          {step.title}
        </h2>
        {step.description && (
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            {step.description}
          </p>
        )}
      </div>

      <div className="space-y-6">
        {visibleFields.map((field) => (
          <div key={field.id} className="group space-y-2">
            <Label
              htmlFor={field.id}
              className="flex items-center gap-1 text-sm font-medium text-text-primary group-focus-within:text-primary"
            >
              <span>{field.label}</span>
              {field.required && (
                <span className="font-bold text-destructive" aria-hidden="true">
                  *
                </span>
              )}
            </Label>
            {field.description && <p id={`${field.id}-description`} className="text-xs text-text-secondary">{field.description}</p>}
            <FieldRenderer field={field} />
          </div>
        ))}
      </div>
    </div>
  );
});
