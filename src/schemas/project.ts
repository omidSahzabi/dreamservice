import { z } from "zod";

export const projectStatuses = ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const projectStatusSchema = z.enum(projectStatuses);
const timestamp = z.string().datetime({ offset: true }).refine(value => {
  const year = new Date(value).getUTCFullYear();
  return year >= 2000 && year <= 2200;
});
export const projectInputSchema = z.object({
  orderId: z.number().int().positive().max(2147483647).nullable(),
  title: z.string().trim().min(1).max(200),
  titleFa: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable(),
  descriptionFa: z.string().trim().max(5000).nullable(),
  status: projectStatusSchema,
  startAt: timestamp.nullable(),
  deadlineAt: timestamp.nullable(),
  isPublic: z.boolean(),
  showOnHomepage: z.boolean(),
}).strict().refine(data => !data.startAt || !data.deadlineAt || Date.parse(data.deadlineAt) > Date.parse(data.startAt))
  .refine(data => !data.showOnHomepage || (data.isPublic && Boolean(data.deadlineAt) && ["PLANNED", "ACTIVE"].includes(data.status)));
export const projectUpdateSchema = z.object({ data: projectInputSchema, expectedUpdatedAt: z.string().datetime() }).strict();
export const projectListSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).default(""),
  status: z.enum(["", ...projectStatuses]).default(""),
}).strict();
export const managedProjectSchema = z.object({
  id: z.string().uuid(), orderId: z.number().nullable(), title: z.string(), titleFa: z.string(),
  description: z.string().nullable(), descriptionFa: z.string().nullable(), status: projectStatusSchema,
  startAt: z.string().nullable(), deadlineAt: z.string().nullable(), isPublic: z.boolean(), showOnHomepage: z.boolean(),
  createdAt: z.string(), updatedAt: z.string(),
  order: z.object({ order_id: z.number(), status: z.string().nullable(), type: z.string().nullable() }).nullable(),
});
export const projectListResponseSchema = z.object({ data: z.array(managedProjectSchema), total: z.number() });
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ManagedProject = z.infer<typeof managedProjectSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus) {
  return from === to || (from === "PLANNED" && (to === "ACTIVE" || to === "CANCELLED")) ||
    (from === "ACTIVE" && (to === "COMPLETED" || to === "CANCELLED"));
}
