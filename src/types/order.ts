export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox";

export type VisibilityOperator = "AND" | "OR";

export type VisibilityCondition = {
  field: string;
  operator: "equals";
  value: string | number | boolean;
};

export type FieldVisibility = {
  operator: VisibilityOperator;
  conditions: VisibilityCondition[];
};

export type FormOption = {
  value: string;
  label: string;
};

export type FormValidation = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
};

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: FormOption[];
  validation?: FormValidation;
  visibility?: FieldVisibility;
};

export type FormStep = {
  id: string;
  order: number;
  title: string;
  description?: string;
  visibility?: FieldVisibility;
  fields: FormField[];
};

export type OrderFormSettings = {
  showProgress: boolean;
  allowBack: boolean;
  autoNext: boolean;
  saveProgress: boolean;
  submitButtonText: string;
};

export type OrderForm = {
  id: string;
  version: number;
  title: string;
  description?: string;
  settings: OrderFormSettings;
  steps: FormStep[];
};

export type OrderFormConfig = {
  form: OrderForm;
};

export type OrderFormData = Record<
  string,
  string | number | string[] | undefined
>;


export type Order = {
  order_id: number;
  client_id: string;
  type: string | null;
  page_count: number | null;
  budget_range: string | null;
  description: string | null;
  status: string | null;
  cr: string | null;
  meta: Record<string, unknown> | null;
};