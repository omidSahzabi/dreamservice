import {z} from "zod";
import type {FormField, FormStep, OrderFormData} from "@/types/order";
import {normalizeDigits} from "@/lib/i18n/digits";

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
      let schema = z.string({error: required}).max(Math.min(field.validation?.maxLength ?? 5000, 5000), t("validation.maxLength", {count: Math.min(field.validation?.maxLength ?? 5000, 5000)}));
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
      const optionSchema = field.type === "select" || field.type === "radio"
        ? schema.refine(value => value === "" || Boolean(field.options?.some(option => option.value === value)), t("validation.option"))
        : schema;
      const normalized = z.string({error: required}).transform(value => {
        if (!field.required && value.trim() === "") return "";
        if (field.type === "tel") return normalizeDigits(value.trim());
        return field.type === "email" ? value.trim() : value;
      }).pipe(field.required ? optionSchema.refine(value => value.trim().length > 0, required) : optionSchema.or(z.literal("")));
      return field.required ? normalized : normalized.optional();
    }
    case "number": {
      let schema = z.number({error: t("validation.number")}).min(-1e9, t("validation.min", {value: -1e9})).max(1e9, t("validation.max", {value: 1e9}));
      if (field.id === "page_count") schema = schema.int(t("validation.number")).positive(t("validation.min", {value: 1}));
      if (field.validation?.min !== undefined) {
        schema = schema.min(field.validation.min, t("validation.min", {value: field.validation.min}));
      }
      if (field.validation?.max !== undefined) {
        schema = schema.max(field.validation.max, t("validation.max", {value: field.validation.max}));
      }
      return field.required ? schema : schema.optional();
    }
    case "checkbox": {
      const schema = z.array(z.string().max(150, t("validation.maxLength", {count: 150})), {error: t("validation.selection")}).max(100, t("validation.selection"))
        .refine(values => new Set(values).size === values.length && values.every(value => field.options?.some(option => option.value === value)), t("validation.option"));
      return field.required ? schema.min(1, t("validation.selection")) : schema.optional();
    }
  }
}

export function getVisibleFields(step: FormStep, values: OrderFormData, steps: FormStep[] = [step]) {
  const fields = new Map(steps.flatMap(item => item.fields).map(field => [field.id, field]));
  const visiting = new Set<string>();
  const resolved = new Map<string, boolean>();
  function visible(field: FormField): boolean {
    const cached = resolved.get(field.id);
    if (cached !== undefined) return cached;
    if (visiting.has(field.id)) return false;
    visiting.add(field.id);
    const visibility = field.visibility;
    const results = visibility?.conditions.map(condition => {
      const dependency = fields.get(condition.field);
      // Hidden fields cannot supply values that suppress another required field.
      const value = dependency && !visible(dependency) ? undefined : values[condition.field];
      return condition.operator === "equals" ? value === condition.value : value !== condition.value;
    });
    const result = !results?.length || (visibility?.operator === "AND" ? results.every(Boolean) : results.some(Boolean));
    visiting.delete(field.id);
    resolved.set(field.id, result);
    return result;
  }
  return step.fields.filter(visible);
}

export function createStepSchema(step: FormStep, values: OrderFormData, t: ValidationTranslator, steps: FormStep[] = [step]) {
  const shape: Record<string, z.ZodType<FieldValue, FieldValue>> = {};
  for (const field of getVisibleFields(step, values, steps)) shape[field.id] = createFieldSchema(field, t);
  return z.object(shape);
}

export function createFormSchema(steps: FormStep[], values: OrderFormData, t: ValidationTranslator) {
  const shape: Record<string, z.ZodType<FieldValue, FieldValue>> = {};
  for (const step of steps) {
    for (const field of getVisibleFields(step, values, steps)) shape[field.id] = createFieldSchema(field, t);
  }
  return z.object(shape);
}
