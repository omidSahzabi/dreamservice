// types/step.types.ts

export type StepFieldType =
  | 'card-select'
  | 'radio-card'
  | 'chip-multiselect'
  | 'toggle-group'
  | 'slider'
  | 'number-input'
  | 'text-input'
  | 'email-input'
  | 'textarea'
  | 'url-input'
  | 'file-upload'
  | 'date-picker'
  | 'conditional-text-input';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType;
  badge?: string;
}

// ─── Discriminated union per field type ──────────────────────────────────────

interface BaseField {
  name: keyof OrderFormData;
  label?: string;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}

export type CardSelectField = BaseField & {
  type: 'card-select';
  options: SelectOption[];
  columns?: 2 | 3 | 4;
};

export type ChipMultiselectField = BaseField & {
  type: 'chip-multiselect';
  options: SelectOption[];
  min?: number;
  max?: number;
};

export type SliderField = BaseField & {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  labels: Record<number, string>;
  formatValue?: (v: number) => string;
};

export type TextInputField = BaseField & {
  type: 'text-input' | 'email-input' | 'url-input';
};

export type TextareaField = BaseField & {
  type: 'textarea';
  rows?: number;
  maxLength?: number;
};

export type ConditionalTextField = BaseField & {
  type: 'conditional-text-input';
  condition: (values: Partial<OrderFormData>) => boolean;
  inner: TextInputField;
};

export type StepField =
  | CardSelectField
  | ChipMultiselectField
  | SliderField
  | TextInputField
  | TextareaField
  | ConditionalTextField;

// ─── Step Configuration ───────────────────────────────────────────────────────

import { ZodSchema } from 'zod';

export interface OrderStep {
  id: string;
  index: number;
  title: string;
  description: string;
  fields: StepField[];
  schema: ZodSchema;
  optional?: boolean;
  estimatedSeconds?: number;

  // Conditional display — skip this step based on previous answers
  shouldShow?: (values: Partial<OrderFormData>) => boolean;

  // Called when step is completed — can transform/normalize data
  onComplete?: (values: Partial<OrderFormData>) => Partial<OrderFormData>;

  // Hint text shown below the title
  hint?: string;
}