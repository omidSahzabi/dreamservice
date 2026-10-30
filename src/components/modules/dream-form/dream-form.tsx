'use client';

import React, { useEffect, useState } from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import { useForm, SubmitHandler, FieldErrors, RegisterOptions } from 'react-hook-form';
import clsx from 'clsx';
import { DreamServiceLoader } from '@/components/brand/DreamServiceLoader';

// ============== Types ==============
type InputType = 
  | 'text' 
  | 'email' 
  | 'password' 
  | 'number' 
  | 'tel' 
  | 'url' 
  | 'date' 
  | 'time' 
  | 'datetime-local'
  | 'color'
  | 'range'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'textarea'
  | 'file';

type ValidationType = 'required' | 'email' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern';

interface ValidationRule {
  type: ValidationType;
  value?: string | number | RegExp;
  message: string;
}

interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: InputType;
  placeholder?: string;
    showLabel?: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: SelectOption[];
  validation?: ValidationRule[];
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  rows?: number;
  accept?: string;
  multiple?: boolean;
  prefix?: string | React.ReactNode;
  suffix?: string | React.ReactNode;
}

type FormValues = Record<string, unknown>;
const inputValue = (value: unknown): string | number | readonly string[] => typeof value === "string" || typeof value === "number" ? value : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : "";
const arrayValue = (value: unknown): (string | number)[] => Array.isArray(value) ? value.filter((item): item is string | number => typeof item === "string" || typeof item === "number") : [];

interface DreamFormProps {
  fields: FieldConfig[];
  submitText?: string;
  resetText?: string;
  showSubmitButton?: boolean;
  onSubmit: (data: FormValues) => void | Promise<void>;
  onError?: (errors: FieldErrors<FormValues>) => void;
  onReset?: () => void;
  onValuesChange?: (data: FormValues) => void;
  className?: string;
  submitClassName?: string;
  resetClassName?: string;
  showResetButton?: boolean;
  layout?: 'vertical' | 'horizontal';
  gridColumns?: number;
}

// ============== Component ==============
export const DreamForm: React.FC<DreamFormProps> = ({
  fields,
  submitText,
  resetText,
  onSubmit,
   showSubmitButton = true ,
  onError,
  onReset,
  onValuesChange,
  className = '',
  submitClassName = '',
  resetClassName = '',
  showResetButton = true,
  layout = 'vertical',
  gridColumns = 2,
}) => {
  const t = useTranslations("DreamForm");
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    trigger,
    subscribe,
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: fields.reduce<FormValues>((acc, field) => {
      if (field.defaultValue !== undefined) {
        acc[field.name] = field.defaultValue;
      }
      return acc;
    }, {}),
  });

  useEffect(() => {
    if (!onValuesChange) return;
    return subscribe({formState: {values: true}, callback: ({values}) => onValuesChange(values)});
  }, [subscribe, onValuesChange]);

  const getValidationRules = (field: FieldConfig) => {
    const rules: RegisterOptions<FormValues> = {};
    
    field.validation?.forEach((validation) => {
      switch (validation.type) {
        case 'required':
          rules.required = validation.message;
          break;
        case 'email':
          rules.pattern = {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: validation.message,
          };
          break;
        case 'minLength':
          rules.minLength = {
            value: typeof validation.value === "number" ? validation.value : 0,
            message: validation.message,
          };
          break;
        case 'maxLength':
          rules.maxLength = {
            value: typeof validation.value === "number" ? validation.value : 0,
            message: validation.message,
          };
          break;
        case 'min':
          rules.min = {
            value: typeof validation.value === "number" ? validation.value : 0,
            message: validation.message,
          };
          break;
        case 'max':
          rules.max = {
            value: typeof validation.value === "number" ? validation.value : 0,
            message: validation.message,
          };
          break;
        case 'pattern':
          rules.pattern = {
            value: validation.value instanceof RegExp ? validation.value : new RegExp(String(validation.value ?? "")),
            message: validation.message,
          };
          break;
      }
    });

    return rules;
  };

  const handleFormSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } catch {
      toast.error(t("submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    reset();
    onReset?.();
  };

  const watchedValues = watch();

  const renderField = (field: FieldConfig) => {
    const validationRules = getValidationRules(field);
    const registerResult = register(field.name, validationRules);
    const message = errors[field.name]?.message;
    const error = typeof message === "string" ? message : undefined;

const baseInputClasses = clsx(
  'w-full px-4 py-3 rounded-lg border transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
  'disabled:bg-muted disabled:cursor-not-allowed',
  'placeholder:text-muted-foreground',
  error 
    ? 'border-destructive focus:ring-destructive bg-destructive/10'
    : 'border-input bg-card text-foreground hover:border-primary/60',
  field.inputClassName
);

    const labelClasses = clsx(
      'block text-sm font-medium text-text-secondary mb-2',
      field.labelClassName
    );

    const errorClasses = clsx(
      'text-sm text-destructive mt-1',
      field.errorClassName
    );

    const renderInput = () => {
      switch (field.type) {
        case 'select':
          return (
            <select
              id={field.name}
              aria-label={field.showLabel === false ? field.label : undefined}
              value={inputValue(watchedValues[field.name])}
              onChange={(e) => {
                registerResult.onChange({ target: { name: field.name, value: e.target.value } });
                trigger(field.name);
              }}
              onBlur={registerResult.onBlur}
              disabled={field.disabled}
              className={baseInputClasses}
            >
              <option value="">{field.placeholder || t("select")}</option>
              {field.options?.map((option) => (
                <option 
                  key={option.value} 
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))}
            </select>
          );

        case 'textarea':
          return (
            <textarea
              id={field.name}
              aria-label={field.showLabel === false ? field.label : undefined}
              value={inputValue(watchedValues[field.name])}
              onChange={(e) => {
                registerResult.onChange({ target: { name: field.name, value: e.target.value } });
                trigger(field.name);
              }}
              onBlur={registerResult.onBlur}
              placeholder={field.placeholder}
              disabled={field.disabled}
              readOnly={field.readOnly}
              rows={field.rows || 4}
              className={baseInputClasses}
            />
          );

        case 'checkbox':
          if (field.options) {
            // چندتا checkbox (checkbox group)
            return (
              <div className="flex flex-col gap-2">
                {field.options.map((option) => {
                  const isChecked = arrayValue(watchedValues[field.name]).includes(option.value);
                  
                  return (
                    <label 
                      key={option.value} 
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentValues = arrayValue(watchedValues[field.name]);
                          if (e.target.checked) {
                            registerResult.onChange({ 
                              target: { 
                                name: field.name, 
                                value: [...currentValues, option.value] 
                              } 
                            });
                          } else {
                            registerResult.onChange({ 
                              target: { 
                                name: field.name, 
                                value: currentValues.filter((v) => v !== option.value)
                              } 
                            });
                          }
                          trigger(field.name);
                        }}
                        disabled={field.disabled || option.disabled}
                        className="w-5 h-5 text-primary rounded border-input focus:ring-ring"
                      />
                      <span className="text-text-secondary">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            );
          } else {
            // تک checkbox
            return (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(watchedValues[field.name])}
                  onChange={(e) => {
                    registerResult.onChange({ 
                      target: { 
                        name: field.name, 
                        value: e.target.checked 
                      } 
                    });
                    trigger(field.name);
                  }}
                  onBlur={registerResult.onBlur}
                  disabled={field.disabled}
                  className="w-5 h-5 text-primary rounded border-input focus:ring-ring"
                />
                <span className="text-text-secondary">{field.label}</span>
              </label>
            );
          }

        case 'radio':
          return (
            <div className="flex flex-col gap-2">
              {field.options?.map((option) => (
                <label 
                  key={option.value} 
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={option.value}
                    checked={watchedValues[field.name] === option.value}
                    onChange={(e) => {
                      registerResult.onChange({ 
                        target: { 
                          name: field.name, 
                          value: e.target.value 
                        } 
                      });
                      trigger(field.name);
                    }}
                    disabled={field.disabled || option.disabled}
                    className="w-5 h-5 text-primary border-input focus:ring-ring"
                  />
                  <span className="text-text-secondary">{option.label}</span>
                </label>
              ))}
            </div>
          );

        case 'file':
          return (
            <input
              type="file"
              accept={field.accept}
              multiple={field.multiple}
              onChange={(e) => {
                registerResult.onChange({ 
                  target: { 
                    name: field.name, 
                    value: e.target.files 
                  } 
                });
                trigger(field.name);
              }}
              onBlur={registerResult.onBlur}
              disabled={field.disabled}
              className={clsx(baseInputClasses, 'file:me-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer')}
            />
          );

        case 'range':
          return (
            <div className="flex items-center gap-4">
              <input
                type="range"
                value={inputValue(watchedValues[field.name]) || 0}
                onChange={(e) => {
                  registerResult.onChange({ 
                    target: { 
                      name: field.name, 
                      value: Number(e.target.value) 
                    } 
                  });
                  trigger(field.name);
                }}
                onBlur={registerResult.onBlur}
                disabled={field.disabled}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-medium text-text-secondary min-w-[40px] text-center">
                {inputValue(watchedValues[field.name]) || 0}
              </span>
            </div>
          );

        case 'color':
          return (
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={inputValue(watchedValues[field.name]) || "#000000"}
                onChange={(e) => {
                  registerResult.onChange({ 
                    target: { 
                      name: field.name, 
                      value: e.target.value 
                    } 
                  });
                  trigger(field.name);
                }}
                onBlur={registerResult.onBlur}
                disabled={field.disabled}
                className="w-12 h-12 p-1 rounded-lg border border-input cursor-pointer"
              />
              <input
                type="text"
                value={inputValue(watchedValues[field.name])}
                onChange={(e) => {
                  registerResult.onChange({ 
                    target: { 
                      name: field.name, 
                      value: e.target.value 
                    } 
                  });
                  trigger(field.name);
                }}
                onBlur={registerResult.onBlur}
                placeholder={field.placeholder}
                disabled={field.disabled}
                className={baseInputClasses}
              />
            </div>
          );

        default:
          return (
            <div className="relative">
              {field.prefix && (
                <span className="absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {field.prefix}
                </span>
              )}
              <input
                type={field.type}
                id={field.name}
                aria-label={field.showLabel === false ? field.label : undefined}
                dir={["email", "tel", "url", "number"].includes(field.type) ? "ltr" : undefined}
                value={inputValue(watchedValues[field.name])}
                onChange={(e) => {
                  const value = field.type === 'number' 
                    ? (e.target.value === '' ? '' : Number(e.target.value))
                    : e.target.value;
                  registerResult.onChange({ 
                    target: { 
                      name: field.name, 
                      value 
                    } 
                  });
                  trigger(field.name);
                }}
                onBlur={registerResult.onBlur}
                placeholder={field.placeholder}
                disabled={field.disabled}
                readOnly={field.readOnly}
                className={clsx(
                  baseInputClasses, 
                  field.prefix && 'ps-12',
                  field.suffix && 'pe-12'
                )}
              />
              {field.suffix && (
                <span className="absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {field.suffix}
                </span>
              )}
            </div>
          );
      }
    };

    // اگر checkbox تکی باشد، فقط اینپوت را برگردان
    if (field.type === 'checkbox' && !field.options) {
      return (
        <div key={field.name} className={field.className}>
          {renderInput()}
          {error && <span className={errorClasses}>{error}</span>}
        </div>
      );
    }

    return (
      <div key={field.name} className={field.className}>
{field.showLabel !== false && field.type !== 'checkbox' && (
  <label htmlFor={field.name} className={labelClasses}>
    {field.label}
    {field.validation?.some(v => v.type === 'required') && (
      <span className="text-destructive ms-1">*</span>
    )}
  </label>
)}
        {renderInput()}
        {error && <span className={errorClasses}>{error}</span>}
      </div>
    );
  };

  const containerClasses = clsx(
    'w-full',
    layout === 'horizontal' && `grid grid-cols-${gridColumns} gap-4`,
    layout === 'vertical' && 'flex flex-col gap-6',
    className
  );

  const buttonContainerClasses = clsx(
    'flex gap-4 mt-6',
    layout === 'horizontal' && 'col-span-full'
  );

  return (
    <form noValidate
      onSubmit={handleSubmit(handleFormSubmit, onError)} 
      className={containerClasses}
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      {fields.map(renderField)}

      {showSubmitButton &&
        <div className={buttonContainerClasses}>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting || undefined}
          className={clsx(
            'flex-1 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg',
            'hover:bg-primary-hover focus:ring-4 focus:ring-blue-300',
            'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
            submitClassName
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <DreamServiceLoader loading size="sm" decorative className="text-inherit" />
              {t("submitting")}
            </span>
          ) : (
            submitText ?? t("submit")
          )}
        </button>

        {showResetButton && (
          <button
            type="button"
            onClick={handleReset}
            className={clsx(
              'px-6 py-3 bg-secondary text-text-secondary font-medium rounded-lg',
              'hover:bg-accent focus:ring-4 focus:ring-gray-300',
              'transition-all duration-200',
              resetClassName
            )}
          >
            {resetText ?? t("reset")}
          </button>
        )}
      </div>}
    </form>
  );
};

export default DreamForm;
