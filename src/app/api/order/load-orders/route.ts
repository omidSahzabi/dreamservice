import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

export const GetOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  type: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  budget_range: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  client_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  sortBy: z.enum(["order_id", "type", "status", "page_count", "cr"]).default("order_id"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeClient: z.preprocess(
    (val) => val === "true" || val === true || val === "1",
    z.boolean().default(false)
  ),
});

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;

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
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validationResult = GetOrdersQuerySchema.safeParse(rawParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters.",
            details: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { data: filters } = validationResult;
    const { page, limit, sortBy, sortOrder, includeClient } = filters;
    const skip = (page - 1) * limit;

    const where = buildOrdersFilter(filters);

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          client: includeClient
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

    return NextResponse.json(
      {
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message || "An unexpected error occurred while processing your request.",
        },
      },
      { status: 500 }
    );
  }
}
