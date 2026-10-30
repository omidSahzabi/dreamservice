import { z } from "zod";

export const managementActionSchema = z.object({
  action: z.enum(["promote", "demote", "ban", "unban"]),
  reason: z.string().trim().min(1).max(1000),
  expectedAdmin: z.boolean(),
  expectedBanned: z.boolean(),
}).strict();
export const userListSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).default(""),
  role: z.enum(["", "admin", "customer"]).default(""),
  status: z.enum(["", "active", "banned"]).default(""),
}).strict();
export const managedUserSchema = z.object({
  id: z.string(), fname: z.string().nullable(), lname: z.string().nullable(),
  email: z.string().nullable(), contact: z.string().nullable(), cr: z.string().nullable(),
  bannedAt: z.string().nullable(), isAdmin: z.boolean(),
  profiles: z.array(z.object({ pr_id: z.number(), pr_company: z.string().nullable(), role: z.string().nullable() })),
});
export const userListResponseSchema = z.object({ data: z.array(managedUserSchema), total: z.number() });
export const userDetailsResponseSchema = z.object({
  user: managedUserSchema, orderCount: z.number(),
  orders: z.array(z.object({ order_id: z.number(), type: z.string().nullable(), status: z.string().nullable(), cr: z.string().nullable() })),
});
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type ManagementAction = z.infer<typeof managementActionSchema>["action"];
