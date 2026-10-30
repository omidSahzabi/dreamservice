import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { orderFormConfigSchema } from "@/schemas/orderFormConfig";
import { createFormSchema } from "@/schemas/orderSchema";
import { SecurityError } from "@/lib/security/http";
export {canonicalJson} from "@/lib/order/canonical";

const fieldValue = z.union([z.string().max(5000), z.number().finite(), z.array(z.string().max(150)).max(100)]);
const dataSchema = z.record(z.string().max(100), fieldValue);
const reserved = new Set(["client_id", "userId", "user_id", "ownerId", "owner_id", "role", "roles", "status", "price", "total", "idempotency_key", "request_hash", "meta"]);

export function parseOrderRequest(raw: unknown) {
  const wrapper = z.object({ formKey: z.string().max(100).optional(), data: z.unknown().optional() }).passthrough().safeParse(raw);
  if (!wrapper.success) throw new SecurityError(422, "ORDER_INVALID");
  const wrapped = wrapper.data.data !== undefined;
  if (wrapped && Object.keys(wrapper.data).some(key => key !== "data" && key !== "formKey")) throw new SecurityError(422, "ORDER_INVALID");
  const payload = wrapped ? wrapper.data.data : Object.fromEntries(Object.entries(wrapper.data).filter(([key]) => key !== "formKey"));
  const parsed = dataSchema.safeParse(payload);
  if (!parsed.success || Object.keys(parsed.data).length > 100 || Object.keys(parsed.data).some(key => reserved.has(key))) throw new SecurityError(422, "ORDER_INVALID");
  return { formKey: wrapper.data.formKey ?? "order", data: parsed.data };
}

export async function validateOrder(input: ReturnType<typeof parseOrderRequest>) {
  if (input.formKey !== "order") throw new SecurityError(422, "ORDER_INVALID");
  const form = await prisma.orderForm.findFirst({ where: { form_key: input.formKey, status: "published" }, include: { steps: { orderBy: { step_order: "asc" }, include: { fields: { orderBy: { field_order: "asc" }, include: { options: { orderBy: { option_order: "asc" } } } } } } } });
  if (!form) throw new SecurityError(503, "FORM_NOT_FOUND");
  // Labels are irrelevant to authority; validate machine definitions without requiring one locale.
  const config = orderFormConfigSchema.safeParse({ form: { id: String(form.id), key: form.form_key, title: form.form_key, settings: { showProgress: form.show_progress, allowBack: form.allow_back, submitButtonText: "" }, steps: form.steps.map(step => ({
    id: String(step.id), title: step.step_key, order: step.step_order,
    fields: step.fields.map(field => ({ id: field.field_key, type: field.field_type, label: field.field_key, required: field.required, validation: field.validation, visibility: field.visibility, options: field.options.map(option => ({ value: option.option_value, label: option.option_value })) })),
  })) } });
  if (!config.success) throw new SecurityError(503, "FORM_LOAD_FAILED");
  const fields = config.data.form.steps.flatMap(step => step.fields);
  if (new Set(fields.map(field => field.id)).size !== fields.length || fields.some(field => reserved.has(field.id))) throw new SecurityError(503, "FORM_LOAD_FAILED");
  const values = { ...input.data };
  for (const [legacy, current] of [["type", "service_type"], ["description", "project_description"]]) {
    const target = fields.some(field => field.id === current) ? current : legacy;
    const alias = target === current ? legacy : current;
    if (alias in values && fields.some(field => field.id === target)) {
      if (target in values && values[target] !== values[alias]) throw new SecurityError(422, "ORDER_INVALID");
      values[target] = values[alias];
      delete values[alias];
    }
  }
  if (Object.keys(values).some(key => !fields.some(field => field.id === key))) throw new SecurityError(422, "ORDER_INVALID");
  const result = createFormSchema(config.data.form.steps, values, key => key).safeParse(values);
  if (!result.success) throw new SecurityError(422, "ORDER_INVALID");
  const data = result.data;
  const type = data.service_type ?? data.type;
  const budget = data.budget_range;
  const description = data.project_description ?? data.description;
  if (typeof type !== "string" || !type || typeof budget !== "string" || !budget) throw new SecurityError(422, "ORDER_INVALID");
  if (data.page_count !== undefined && (typeof data.page_count !== "number" || !Number.isSafeInteger(data.page_count) || data.page_count <= 0)) throw new SecurityError(422, "ORDER_INVALID");
  return { type, budget_range: budget, description: typeof description === "string" ? description : null, page_count: typeof data.page_count === "number" ? data.page_count : null, meta: { formKey: input.formKey, ...data } };
}
