"use client";

import { memo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { AlertCircle, Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FormField, OrderFormData } from "@/types/order";

const baseInputClass =
  "h-12 rounded-xl border border-border-soft bg-bg-primary/50 px-4 text-sm text-text-primary shadow-sm transition-all duration-200 placeholder:text-text-muted hover:border-primary/30 focus-visible:border-primary focus-visible:bg-bg-primary focus-visible:ring-4 focus-visible:ring-primary/10";

export const FieldRenderer = memo(function FieldRenderer({
  field,
}: {
  field: FormField;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<OrderFormData>();
  const t = useTranslations("OrderForm");
  const locale = useLocale();
  const error = typeof errors[field.id]?.message === "string" ? errors[field.id]?.message : undefined;

  return (
    <div className="space-y-2">
      <Controller
        name={field.id}
        control={control}
        render={({ field: formField }) => {
          const value = formField.value;

          switch (field.type) {
            case "text":
            case "email":
            case "tel":
              return (
                <Input
                  {...formField}
                  id={field.id}
                  type={field.type}
                  value={typeof value === "string" ? value : ""}
                  placeholder={field.placeholder}
                  className={baseInputClass}
                  dir={field.type === "text" ? (locale === "fa" ? "rtl" : "ltr") : "ltr"}
                />
              );

            case "number":
              return (
                <Input
                  id={field.id}
                  type="number"
                  value={value !== undefined && value !== null ? String(value) : ""}
                  placeholder={field.placeholder}
                  onChange={(e) => {
                    const raw = e.target.value;
                    formField.onChange(raw === "" ? undefined : Number(raw));
                  }}
                  className={baseInputClass}
                  dir="ltr"
                />
              );

            case "textarea":
              return (
                <Textarea
                  {...formField}
                  id={field.id}
                  value={typeof value === "string" ? value : ""}
                  placeholder={field.placeholder}
                  className="min-h-32 resize-y rounded-xl border border-border-soft bg-bg-primary/50 p-4 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                />
              );

            case "select":
              return (
                <Select
                  value={typeof value === "string" ? value : ""}
                  onValueChange={formField.onChange}
                >
                  <SelectTrigger id={field.id} className={baseInputClass}>
                    <SelectValue placeholder={t("selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent
                    dir={locale === "fa" ? "rtl" : "ltr"}
                    className="rounded-xl border border-border-soft bg-bg-primary p-1 shadow-xl"
                  >
                    {field.options?.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="cursor-pointer rounded-lg text-sm"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );

            case "radio":
              return (
                <RadioGroup
                  aria-label={field.label}
                  value={typeof value === "string" ? value : ""}
                  onValueChange={formField.onChange}
                  className="grid gap-2.5 sm:grid-cols-2"
                >
                  {field.options?.map((opt) => {
                    const isSelected = value === opt.value;
                    return (
                      <label
                        key={opt.value}
                        htmlFor={`${field.id}-${opt.value}`}
                        className={`relative flex min-h-14 cursor-pointer items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                            : "border-border-soft/80 bg-bg-primary/30 hover:border-primary/30 hover:bg-bg-primary/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem
                            id={`${field.id}-${opt.value}`}
                            value={opt.value}
                          />
                          <span
                            className={
                              isSelected
                                ? "text-sm font-semibold text-primary"
                                : "text-sm text-text-primary"
                            }
                          >
                            {opt.label}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="flex size-5 items-center justify-center rounded-full bg-primary text-white">
                            <Check className="size-3" strokeWidth={3} />
                          </div>
                        )}
                      </label>
                    );
                  })}
                </RadioGroup>
              );

            case "checkbox": {
              const selectedValues = Array.isArray(value)
                ? value
                : [];
              const handleToggle = (optValue: string) => {
                const next = selectedValues.includes(optValue)
                  ? selectedValues.filter((v) => v !== optValue)
                  : [...selectedValues, optValue];
                formField.onChange(next);
              };

              return (
                <div role="group" aria-label={field.label} className="grid gap-2.5 sm:grid-cols-2">
                  {field.options?.map((opt) => {
                    const isChecked = selectedValues.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        htmlFor={`${field.id}-${opt.value}`}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all duration-200 ${
                          isChecked
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                            : "border-border-soft/80 bg-bg-primary/30 hover:border-primary/30 hover:bg-bg-primary/60"
                        }`}
                      >
                        <Checkbox
                          id={`${field.id}-${opt.value}`}
                          checked={isChecked}
                          onCheckedChange={() => handleToggle(opt.value)}
                        />
                        <span
                          className={
                            isChecked
                              ? "text-sm font-semibold text-primary"
                              : "text-sm text-text-primary"
                          }
                        >
                          {opt.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            }

            default:
              return (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
                  <AlertCircle className="size-4" />
                  <span> 
                 {t("unsupportedField")}
                    </span>
                </div>
              );
          }
        }}
      />
      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
});
