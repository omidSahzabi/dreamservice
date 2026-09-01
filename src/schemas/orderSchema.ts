import { z } from "zod";

import type {
  FormField,
  FormStep,
  OrderFormData,
} from "@/types/order";

function createFieldSchema(field: FormField) {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "textarea":
    case "select":
    case "radio": {
      schema = z.string();

      if (field.type === "email") {
        schema = (schema as z.ZodString).email(
          "ایمیل وارد شده معتبر نیست."
        );
      }

      if (field.validation?.minLength) {
        schema = (schema as z.ZodString).min(
          field.validation.minLength,
          `حداقل ${field.validation.minLength} کاراکتر وارد کنید.`
        );
      }

      if (field.validation?.maxLength) {
        schema = (schema as z.ZodString).max(
          field.validation.maxLength,
          `حداکثر ${field.validation.maxLength} کاراکتر مجاز است.`
        );
      }

      if (field.validation?.pattern) {
        schema = (schema as z.ZodString).regex(
          new RegExp(field.validation.pattern),
          "مقدار وارد شده معتبر نیست."
        );
      }

      if (field.required) {
        schema = (schema as z.ZodString).min(
          1,
          "این فیلد الزامی است."
        );
      } else {
        schema = schema.optional();
      }

      return schema;
    }

    case "number": {
      schema = z.number({
        message: "یک عدد معتبر وارد کنید.",
      });

      if (field.validation?.min !== undefined) {
        schema = (schema as z.ZodNumber).min(
          field.validation.min,
          `حداقل مقدار ${field.validation.min} است.`
        );
      }

      if (field.validation?.max !== undefined) {
        schema = (schema as z.ZodNumber).max(
          field.validation.max,
          `حداکثر مقدار ${field.validation.max} است.`
        );
      }

      if (!field.required) {
        schema = schema.optional();
      }

      return schema;
    }

    case "checkbox": {
      schema = z.array(z.string());

      if (field.required) {
        schema = (schema as z.ZodArray<z.ZodString>).min(
          1,
          "حداقل یک گزینه را انتخاب کنید."
        );
      } else {
        schema = schema.optional();
      }

      return schema;
    }

    default:
      return z.any().optional();
  }
}

function isVisible(
  visibility: FormField["visibility"],
  values: OrderFormData
) {
  if (
    !visibility ||
    !Array.isArray(visibility.conditions) ||
    visibility.conditions.length === 0
  ) {
    return true;
  }

  const results = visibility.conditions.map(
    (condition) => {
      switch (condition.operator) {
        case "equals":
          return (
            values[condition.field] === condition.value
          );

        case "not_equals":
          return (
            values[condition.field] !== condition.value
          );

        default:
          return false;
      }
    }
  );

  return visibility.operator === "AND"
    ? results.every(Boolean)
    : results.some(Boolean);
}

export function getVisibleFields(
  step: FormStep,
  values: OrderFormData
) {
  return step.fields.filter((field) =>
    isVisible(field.visibility, values)
  );
}

export function createStepSchema(
  step: FormStep,
  values: OrderFormData
) {
  const visibleFields = getVisibleFields(step, values);

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of visibleFields) {
    shape[field.id] = createFieldSchema(field);
  }

  return z.object(shape);
}

export function createFormSchema(
  steps: FormStep[],
  values: OrderFormData
) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const step of steps) {
    const visibleFields = getVisibleFields(step, values);

    for (const field of visibleFields) {
      shape[field.id] = createFieldSchema(field);
    }
  }

  return z.object(shape);
}