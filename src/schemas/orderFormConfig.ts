import {z} from 'zod';

const visibility = z.preprocess(value => value == null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) ? undefined : value, z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(z.object({
    field: z.string(), operator: z.enum(['equals', 'not_equals']),
    value: z.union([z.string(), z.number(), z.boolean()])
  }))
}).optional());

const validation = z.object({
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  min: z.number().optional(), max: z.number().optional(),
  pattern: z.string().refine(value => {
    try { new RegExp(value); return true; } catch { return false; }
  }).optional()
}).nullish().transform(value => value ?? undefined);

export const orderFormConfigSchema = z.object({
  form: z.object({
    id: z.string(), key: z.string().min(1), title: z.string().trim().min(1),
    description: z.string().optional(),
    settings: z.object({showProgress: z.boolean(), allowBack: z.boolean(), submitButtonText: z.string()}),
    steps: z.array(z.object({
      id: z.string(), order: z.number(), title: z.string().trim().min(1),
      description: z.string().optional(), visibility,
      fields: z.array(z.object({
        id: z.string().min(1),
        type: z.enum(['text', 'email', 'tel', 'number', 'textarea', 'select', 'radio', 'checkbox']),
        label: z.string().trim().min(1), description: z.string().optional(),
        placeholder: z.string().optional(), required: z.boolean().optional(),
        validation, visibility,
        defaultValue: z.union([z.string(), z.number(), z.array(z.string())]).nullish(),
        options: z.array(z.object({
          value: z.string().min(1), label: z.string().trim().min(1),
          description: z.string().optional(), metadata: z.unknown().optional()
        })).optional()
      }))
    })).min(1)
  })
});
