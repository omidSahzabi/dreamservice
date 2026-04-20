// components/modules/dream-form/types.ts
import { z } from "zod";
import { ReactNode } from "react";

export type FieldType = "input" | "textarea" | "select" | "checkbox" | "radio" | "button" | "card";

export interface SelectOption {
  label: string;
  value: string;
}

export interface FieldConfig {
  // Basic
  name: string;
  type: FieldType;
  label?: string;
  placeholder?: string;
  
  // Validation
  validation?: z.ZodTypeAny;
  
  // Options for select/radio/checkbox
  options?: SelectOption[];
  
  // Styling
  style?: React.CSSProperties;
  className?: string;
  
  // State
  disabled?: boolean;
  defaultValue?: unknown;
  
  // Button specific
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  onClick?: () => void;
  
  // Card specific
  cardTitle?: string;
  cardDescription?: string;
  cardContent?: ReactNode;
}

export interface FormConfig {
  fields: FieldConfig[];
  onSubmit: (data: Record<string, unknown>) => void;
  defaultValues?: Record<string, unknown>;
  className?: string;
  submitLabel?: string;
  submitVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  submitSize?: "default" | "sm" | "lg" | "icon";
  resetAfterSubmit?: boolean;
}