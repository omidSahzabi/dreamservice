import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/authorization";
import { privateJson, SecurityError, securityFailure } from "@/lib/security/http";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const GetOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(10000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  type: z.preprocess(emptyToUndefined, z.string().trim().max(150).optional()),
  status: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  budget_range: z.preprocess(emptyToUndefined, z.string().trim().max(150).optional()),
  client_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  sortBy: z.enum(["order_id", "type", "status", "page_count", "cr"]).default("order_id"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeClient: z.preprocess(
    (val) => val === undefined || val === "false" || val === "0" ? false : val === "true" || val === "1" ? true : val,
    z.boolean().default(false)
  ),
}).strict();

type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;

function buildOrdersFilter(query: GetOrdersQuery): Prisma.OrderWhereInput {
  const { client_id, type, status, budget_range, search } = query;

  const where: Prisma.OrderWhereInput = {
    ...(client_id && { client_id }),
    ...(type && { type }),
    ...(status && { status }),
    ...(budget_range && { budget_range }),
  };

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { type: { contains: search, mode: "insensitive" } },
      { budget_range: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const principal = await requireAuth();
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    if (Object.keys(rawParams).some(key => request.nextUrl.searchParams.getAll(key).length !== 1)) throw new SecurityError(422, "INVALID_INPUT");
    const validationResult = GetOrdersQuerySchema.safeParse(rawParams);

    if (!validationResult.success) {
      throw new SecurityError(422, "INVALID_INPUT");
    }

    const { data: filters } = validationResult;
    const { page, limit, sortBy, sortOrder, includeClient } = filters;
    if (principal.permission !== "ADMIN" && ((filters.client_id && filters.client_id !== principal.id) || includeClient)) throw new SecurityError(403, "FORBIDDEN");
    const skip = (page - 1) * limit;

    const where = buildOrdersFilter(filters);
    if (principal.permission !== "ADMIN") where.client_id = principal.id;

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          order_id: true, client_id: true, type: true, page_count: true, budget_range: true,
          description: true, status: true, cr: true, meta: principal.permission === "ADMIN",
          statusHistory: {take: 1, orderBy: [{createdAt: "desc"}, {id: "desc"}], select: {message: true, createdAt: true}},
          client: principal.permission === "ADMIN" && includeClient
            ? {
                select: {
                  id: true,
                  email: true,
                  fname: true,
                  lname: true,
                  contact: true,
                },
              }
            : false,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return privateJson(
      {
        success: true,
        data: orders.map(({statusHistory, ...order}) => ({ ...order, meta: principal.permission === "ADMIN" ? order.meta : null, latestDecision: statusHistory?.[0] ?? null })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      }
    );
  } catch (error) {
    return securityFailure(error, "ORDER_LOAD_FAILED");
  }
}
