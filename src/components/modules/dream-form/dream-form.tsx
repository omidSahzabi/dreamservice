'use client';

import React, { useMemo, useState } from 'react';
import {
  useForm,
  SubmitHandler,
  FieldErrors,
  RegisterOptions,
  DefaultValues,
} from 'react-hook-form';
import clsx from 'clsx';

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

type ValidationType =
  | 'required'
  | 'email'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern';

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

interface FieldConfig {
  name: string;
  label: string;
  type: InputType;
  placeholder?: string;
  showLabel?: boolean;
  description?: string;
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
  autoComplete?: string;
  inputMode?:
    | 'text'
    | 'email'
    | 'numeric'
    | 'decimal'
    | 'tel'
    | 'search'
    | 'url'
    | 'none';
  dir?: 'rtl' | 'ltr' | 'auto';
}

interface DreamFormProps {
  fields: FieldConfig[];
  submitText?: string;
  resetText?: string;
  showSubmitButton?: boolean;
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  onError?: (errors: FieldErrors<Record<string, any>>) => void;
  onReset?: () => void;
  className?: string;
  submitClassName?: string;
  resetClassName?: string;
  showResetButton?: boolean;
  layout?: 'vertical' | 'horizontal';
  gridColumns?: 1 | 2 | 3 | 4;
  formError?: string;
  dir?: 'rtl' | 'ltr';
}

// ============== Helpers ==============
const gridColsClassMap: Record<NonNullable<DreamFormProps['gridColumns']>, string> = {
  1: 'grid grid-cols-1 gap-4',
  2: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  3: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4',
  4: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4',
};

const getValidationRules = (field: FieldConfig): RegisterOptions => {
  const rules: RegisterOptions = {};

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
          value: validation.value as number,
          message: validation.message,
        };
        break;
      case 'maxLength':
        rules.maxLength = {
          value: validation.value as number,
          message: validation.message,
        };
        break;
      case 'min':
        rules.min = {
          value: validation.value as number,
          message: validation.message,
        };
        break;
      case 'max':
        rules.max = {
          value: validation.value as number,
          message: validation.message,
        };
        break;
      case 'pattern':
        rules.pattern = {
          value: validation.value as RegExp,
          message: validation.message,
        };
        break;
    }
  });

  return rules;
};

// ============== Component ==============
export const DreamForm: React.FC<DreamFormProps> = ({
  fields,
  submitText = 'ثبت اطلاعات',
  resetText = 'پاک کردن',
  onSubmit,
  showSubmitButton = true,
  onError,
  onReset,
  className = '',
  submitClassName = '',
  resetClassName = '',
  showResetButton = true,
  layout = 'vertical',
  gridColumns = 2,
  formError,
  dir = 'rtl',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues = useMemo(() => {
    return fields.reduce((acc, field) => {
      if (field.defaultValue !== undefined) {
        acc[field.name] = field.defaultValue;
      } else {
        if (field.type === 'checkbox' && field.options) acc[field.name] = [];
        else if (field.type === 'checkbox') acc[field.name] = false;
        else acc[field.name] = '';
      }
      return acc;
    }, {} as DefaultValues<Record<string, any>>);
  }, [fields]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Record<string, any>>({
    mode: 'onChange',
    defaultValues,
  });

  const handleFormSubmit: SubmitHandler<Record<string, any>> = async (data) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    reset(defaultValues);
    onReset?.();
  };

  const renderField = (field: FieldConfig) => {
    const validationRules = getValidationRules(field);
    const error = errors[field.name]?.message as string | undefined;

    const baseInputClasses = clsx(
      'w-full px-4 py-3 rounded-lg border transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:border-transparent',
      'disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70',
      'placeholder:text-gray-500',
      error
        ? 'border-red-500 focus:ring-red-500 bg-red-900/20 text-white'
        : 'border-gray-700 bg-gray-800/50 text-white hover:border-gray-600 focus:ring-blue-500',
      field.inputClassName
    );

    const labelClasses = clsx(
      'block text-sm font-medium text-gray-200 mb-2',
      field.labelClassName
    );

    const errorClasses = clsx(
      'text-sm text-red-400 mt-1',
      field.errorClassName
    );

    const descriptionClasses = 'text-xs text-gray-400 mt-1';

    if (field.type === 'select') {
      return (
        <div key={field.name} className={field.className}>
          {field.showLabel !== false && (
            <label htmlFor={field.name} className={labelClasses}>
              {field.label}
              {field.validation?.some((v) => v.type === 'required') && (
                <span className="text-red-500 mr-1">*</span>
              )}
            </label>
          )}

          <select
            id={field.name}
            dir={field.dir}
            disabled={field.disabled}
            className={baseInputClasses}
            defaultValue={field.defaultValue ?? ''}
            {...register(field.name, validationRules)}
          >
            <option value="">{field.placeholder || 'انتخاب کنید...'}</option>
            {field.options?.map((option) => (
              <option
                key={String(option.value)}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          {field.description && <p className={descriptionClasses}>{field.description}</p>}
          {error && <span className={errorClasses}>{error}</span>}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.name} className={field.className}>
          {field.showLabel !== false && (
            <label htmlFor={field.name} className={labelClasses}>
              {field.label}
              {field.validation?.some((v) => v.type === 'required') && (
                <span className="text-red-500 mr-1">*</span>
              )}
            </label>
          )}

          <textarea
            id={field.name}
            rows={field.rows || 4}
            placeholder={field.placeholder}
            disabled={field.disabled}
            readOnly={field.readOnly}
            dir={field.dir}
            className={baseInputClasses}
            {...register(field.name, validationRules)}
          />

          {field.description && <p className={descriptionClasses}>{field.description}</p>}
          {error && <span className={errorClasses}>{error}</span>}
        </div>
      );
    }

    if (field.type === 'checkbox' && !field.options) {
      return (
        <div key={field.name} className={field.className}>
          <label className="flex items-center gap-3 cursor-pointer text-gray-200">
            <input
              type="checkbox"
              disabled={field.disabled}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              {...register(field.name, validationRules)}
            />
            <span>{field.label}</span>
          </label>

          {field.description && <p className={descriptionClasses}>{field.description}</p>}
          {error && <span className={errorClasses}>{error}</span>}
        </div>
      );
    }

    if (field.type === 'radio') {
      return (
        <div key={field.name} className={field.className}>
          {field.showLabel !== false && (
            <label className={labelClasses}>
              {field.label}
              {field.validation?.some((v) => v.type === 'required') && (
                <span className="text-red-500 mr-1">*</span>
              )}
            </label>
          )}

          <div className="flex flex-col gap-2">
            {field.options?.map((option) => (
              <label
                key={String(option.value)}
                className="flex items-center gap-3 cursor-pointer text-gray-200"
              >
                <input
                  type="radio"
                  value={option.value}
                  disabled={field.disabled || option.disabled}
                  className="w-5 h-5 border-gray-300 text-blue-600 focus:ring-blue-500"
                  {...register(field.name, validationRules)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          {field.description && <p className={descriptionClasses}>{field.description}</p>}
          {error && <span className={errorClasses}>{error}</span>}
        </div>
      );
    }

    if (field.type === 'file') {
      return (
        <div key={field.name} className={field.className}>
          {field.showLabel !== false && (
            <label htmlFor={field.name} className={labelClasses}>
              {field.label}
              {field.validation?.some((v) => v.type === 'required') && (
                <span className="text-red-500 mr-1">*</span>
              )}
            </label>
          )}

          <input
            id={field.name}
            type="file"
            accept={field.accept}
            multiple={field.multiple}
            disabled={field.disabled}
            className={clsx(
              baseInputClasses,
              'file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer'
            )}
            {...register(field.name, validationRules)}
          />

          {field.description && <p className={descriptionClasses}>{field.description}</p>}
          {error && <span className={errorClasses}>{error}</span>}
        </div>
      );
    }

    if (field.type === 'checkbox' && field.options) {
      return (
        <div key={field.name} className={field.className}>
          {field.showLabel !== false && (
            <label className={labelClasses}>
              {field.label}
              {field.validation?.some((v) => v.type === 'required') && (
                <span className="text-red-500 mr-1">*</span>
              )}
            </label>
          )}

          <div className="flex flex-col gap-2">
            {field.options.map((option) => (
              <label
                key={String(option.value)}
                className="flex items-center gap-3 cursor-pointer text-gray-200"
              >
                <input
                  type="checkbox"
                  value={String(option.value)}
                  disabled={field.disabled || option.disabled}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  {...register(field.name, validationRules)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          {field.description && <p className={descriptionClasses}>{field.description}</p>}
          {error && <span className={errorClasses}>{error}</span>}
        </div>
      );
    }

    return (
      <div key={field.name} className={field.className}>
        {field.showLabel !== false && (
          <label htmlFor={field.name} className={labelClasses}>
            {field.label}
            {field.validation?.some((v) => v.type === 'required') && (
              <span className="text-red-500 mr-1">*</span>
            )}
          </label>
        )}

        <div className="relative">
          {field.prefix && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
              {field.prefix}
            </span>
          )}

          <input
            id={field.name}
            type={field.type}
            placeholder={field.placeholder}
            disabled={field.disabled}
            readOnly={field.readOnly}
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            dir={field.dir}
            className={clsx(
              baseInputClasses,
              field.prefix && 'pr-12',
              field.suffix && 'pl-12'
            )}
            {...register(field.name, {
              ...validationRules,
              valueAsNumber: field.type === 'number',
            })}
          />

          {field.suffix && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              {field.suffix}
            </span>
          )}
        </div>

        {field.description && <p className={descriptionClasses}>{field.description}</p>}
        {error && <span className={errorClasses}>{error}</span>}
      </div>
    );
  };

  const containerClasses = clsx(
    'w-full',
    layout === 'horizontal' ? gridColsClassMap[gridColumns] : 'flex flex-col gap-6',
    className
  );

  const buttonContainerClasses = clsx(
    'flex gap-4 mt-6',
    layout === 'horizontal' && 'col-span-full'
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onError)} className={containerClasses} dir={dir}>
      {formError && (
        <div className="rounded-lg border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {formError}
        </div>
      )}

      {fields.map(renderField)}

      {showSubmitButton && (
        <div className={buttonContainerClasses}>
          <button
            type="submit"
            disabled={isSubmitting}
            className={clsx(
              'flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg',
              'hover:bg-blue-700 focus:ring-4 focus:ring-blue-300',
              'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
              submitClassName
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                در حال ارسال...
              </span>
            ) : (
              submitText
            )}
          </button>

          {showResetButton && (
            <button
              type="button"
              onClick={handleReset}
              className={clsx(
                'px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg',
                'hover:bg-gray-300 focus:ring-4 focus:ring-gray-300',
                'transition-all duration-200',
                resetClassName
              )}
            >
              {resetText}
            </button>
          )}
        </div>
      )}
    </form>
  );
};

export default DreamForm;
