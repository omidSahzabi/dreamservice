import {z} from "zod";

export const transitionSchema = z.object({
  expectedStatus: z.enum(["PENDING", "NEGOTIATING"]),
  newStatus: z.enum(["NEGOTIATING", "PROCESSING", "REJECTED"]),
  message: z.string().trim().min(1).max(2000),
}).strict();

export function allowedOrderActions(status: string | null) {
  if (status === "PENDING") return ["NEGOTIATING", "REJECTED"] as const;
  if (status === "NEGOTIATING") return ["PROCESSING", "REJECTED"] as const;
  return [];
}

export const historyResponseSchema = z.object({
  success: z.literal(true),
  order: z.object({order_id: z.number().int(), status: z.string().nullable(),
    type: z.string().nullable().optional(), page_count: z.number().nullable().optional(),
    budget_range: z.string().nullable().optional(), description: z.string().nullable().optional(),
  }),
  history: z.array(z.object({
    id: z.string().uuid(), previousStatus: z.string(), newStatus: z.string(),
    message: z.string(), createdAt: z.string().datetime(),
    notificationState: z.enum(["PENDING", "CLAIMED", "SENT", "FAILED", "UNKNOWN", "SKIPPED"]).optional(), notificationAttempts: z.number().int().optional(),
    notificationNextAttemptAt: z.string().datetime().optional(),
  })),
});
