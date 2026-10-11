import {z} from "zod";
import type {FormField, FormStep, OrderFormData} from "@/types/order";

export type ValidationTranslator = (key: string, values?: Record<string, number>) => string;
type FieldValue = OrderFormData[string];

function createFieldSchema(field: FormField, t: ValidationTranslator): z.ZodType<FieldValue, FieldValue> {
  const required = t("validation.required");
  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "textarea":
    case "select":
    case "radio": {
      let schema = z.string({error: required});
      if (field.type === "email") schema = schema.email(t("validation.email"));
      if (field.validation?.minLength !== undefined) {
        schema = schema.min(field.validation.minLength, t("validation.minLength", {count: field.validation.minLength}));
      }
      if (field.validation?.maxLength !== undefined) {
        schema = schema.max(field.validation.maxLength, t("validation.maxLength", {count: field.validation.maxLength}));
      }
      if (field.validation?.pattern) {
        schema = schema.regex(new RegExp(field.validation.pattern), t("validation.pattern"));
      }
      return field.required ? schema.min(1, required) : schema.optional().or(z.literal(""));
    }
    case "number": {
      let schema = z.number({error: t("validation.number")});
      if (field.validation?.min !== undefined) {
        schema = schema.min(field.validation.min, t("validation.min", {value: field.validation.min}));
      }
      if (field.validation?.max !== undefined) {
        schema = schema.max(field.validation.max, t("validation.max", {value: field.validation.max}));
      }
      return field.required ? schema : schema.optional();
    }
    case "checkbox": {
      const schema = z.array(z.string(), {error: t("validation.selection")});
      return field.required ? schema.min(1, t("validation.selection")) : schema.optional();
    }
  }
}

function isVisible(visibility: FormField["visibility"], values: OrderFormData) {
  if (!visibility?.conditions.length) return true;
  const results = visibility.conditions.map(condition =>
    condition.operator === "equals"
      ? values[condition.field] === condition.value
      : values[condition.field] !== condition.value
  );
  return visibility.operator === "AND" ? results.every(Boolean) : results.some(Boolean);
}

export function getVisibleFields(step: FormStep, values: OrderFormData) {
  return step.fields.filter(field => isVisible(field.visibility, values));
}

export function createStepSchema(step: FormStep, values: OrderFormData, t: ValidationTranslator) {
  const shape: Record<string, z.ZodType<FieldValue, FieldValue>> = {};
  for (const field of getVisibleFields(step, values)) shape[field.id] = createFieldSchema(field, t);
  return z.object(shape);
}

export function createFormSchema(steps: FormStep[], values: OrderFormData, t: ValidationTranslator) {
  const shape: Record<string, z.ZodType<FieldValue, FieldValue>> = {};
  for (const step of steps) {
    for (const field of getVisibleFields(step, values)) shape[field.id] = createFieldSchema(field, t);
  }
  return z.object(shape);
}
