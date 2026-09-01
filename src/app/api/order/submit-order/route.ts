import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DEFAULT_TEST_CLIENT_ID = "08023504-6341-4cca-9a08-3d969907b90a";

const createOrderSchema = z.object({
  type: z.string().min(1, "نوع سفارش الزامی است"),
  budget_range: z.string().min(1, "بازه بودجه الزامی است"),
  status: z.string().default("PENDING"),
  page_count: z.number().int().optional().nullable(),
  description: z.string().optional().nullable(),
  client_id: z.string().uuid().optional(),
  meta: z.record(z.any()).optional().default({}),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const payload = rawBody?.data ?? rawBody;

    const type = payload.type || payload.service_type;
    const description = payload.description || payload.project_description || null;
    const budget_range = payload.budget_range;
    const page_count = payload.page_count ? Number(payload.page_count) : null;
    const status = payload.status || "PENDING";
    const client_id = payload.client_id || DEFAULT_TEST_CLIENT_ID;

    const validated = createOrderSchema.parse({
      type,
      budget_range,
      status,
      page_count,
      description,
      client_id,
      meta: {
        formKey: rawBody.formKey,
        ...payload,
      },
    });

    const newOrder = await prisma.order.create({
      data: {
        client_id: validated.client_id!,
        type: validated.type,
        budget_range: validated.budget_range,
        status: validated.status,
        page_count: validated.page_count,
        description: validated.description,
        meta: validated.meta,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "سفارش با موفقیت در دیتابیس ثبت شد",
        order_id: newOrder.order_id,
        data: newOrder,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST Order Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "اطلاعات ارسالی معتبر نیست",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "خطایی در ثبت سفارش رخ داد",
        error: error?.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
