'use client';

import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
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

interface FieldConfig {
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

interface DreamFormProps {
  fields: FieldConfig[];
  submitText?: string;
  resetText?: string;
  showSubmitButton?: boolean;
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  onError?: (errors: Record<string, any>) => void;
  onReset?: () => void;
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
  submitText = 'ثبت اطلاعات',
  resetText = 'پاک کردن',
  onSubmit,
   showSubmitButton = true ,
  onError,
  onReset,
  className = '',
  submitClassName = '',
  resetClassName = '',
  showResetButton = true,
  layout = 'vertical',
  gridColumns = 2,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    trigger,
  } = useForm({
    mode: 'onChange',
    defaultValues: fields.reduce((acc, field) => {
      if (field.defaultValue !== undefined) {
        acc[field.name] = field.defaultValue;
      }
      return acc;
    }, {} as Record<string, any>),
  });

  const getValidationRules = (field: FieldConfig) => {
    const rules: Record<string, any> = {};
    
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
    reset();
    onReset?.();
  };

  const watchedValues = watch();

  const renderField = (field: FieldConfig) => {
    const validationRules = getValidationRules(field);
    const registerResult = register(field.name, validationRules);
    const error = errors[field.name]?.message as string;

const baseInputClasses = clsx(
  'w-full px-4 py-3 rounded-lg border transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  'disabled:bg-gray-800 disabled:cursor-not-allowed',
  'placeholder:text-gray-500',
  error 
    ? 'border-red-500 focus:ring-red-500 bg-red-900/20' 
    : 'border-gray-700 bg-gray-800/50 text-white hover:border-gray-600',
  field.inputClassName
);

    const labelClasses = clsx(
      'block text-sm font-medium text-gray-700 mb-2',
      field.labelClassName
    );

    const errorClasses = clsx(
      'text-sm text-red-500 mt-1',
      field.errorClassName
    );

    const renderInput = () => {
      switch (field.type) {
        case 'select':
          return (
            <select
              value={watchedValues[field.name] || ''}
              onChange={(e) => {
                registerResult.onChange({ target: { name: field.name, value: e.target.value } });
                trigger(field.name);
              }}
              onBlur={registerResult.onBlur}
              disabled={field.disabled}
              className={baseInputClasses}
            >
              <option value="">{field.placeholder || 'انتخاب کنید...'}</option>
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
              value={watchedValues[field.name] || ''}
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
                  const isChecked = Array.isArray(watchedValues[field.name]) 
                    ? watchedValues[field.name].includes(option.value)
                    : false;
                  
                  return (
                    <label 
                      key={option.value} 
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentValues = Array.isArray(watchedValues[field.name]) 
                            ? watchedValues[field.name] 
                            : [];
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
                                value: currentValues.filter((v: any) => v !== option.value) 
                              } 
                            });
                          }
                          trigger(field.name);
                        }}
                        disabled={field.disabled || option.disabled}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{option.label}</span>
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
                  checked={watchedValues[field.name] || false}
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
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700">{field.label}</span>
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
                    className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option.label}</span>
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
              className={clsx(baseInputClasses, 'file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer')}
            />
          );

        case 'range':
          return (
            <div className="flex items-center gap-4">
              <input
                type="range"
                value={watchedValues[field.name] || 0}
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
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700 min-w-[40px] text-center">
                {watchedValues[field.name] || 0}
              </span>
            </div>
          );

        case 'color':
          return (
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={watchedValues[field.name] || '#000000'}
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
                className="w-12 h-12 p-1 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={watchedValues[field.name] || ''}
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
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  {field.prefix}
                </span>
              )}
              <input
                type={field.type}
                value={watchedValues[field.name] || ''}
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
                  field.prefix && 'pr-12', 
                  field.suffix && 'pl-12'
                )}
              />
              {field.suffix && (
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
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
  <label className={labelClasses}>
    {field.label}
    {field.validation?.some(v => v.type === 'required') && (
      <span className="text-red-500 mr-1">*</span>
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
    <form 
      onSubmit={handleSubmit(handleFormSubmit, onError)} 
      className={containerClasses}
      dir="rtl"
    >
      {fields.map(renderField)}

      {showSubmitButton &&
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
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
      </div>}
    </form>
  );
};

export default DreamForm;