import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";

const switchRoleSchema = z.object({
  role: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر احراز هویت نشده است" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = switchRoleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "نقش ارسالی نامعتبر است" },
        { status: 422 }
      );
    }

    const { role } = result.data;
    const hasRole = user.roles.includes(role);

    if (!hasRole) {
      return NextResponse.json(
        { success: false, error: "دسترسی به این نقش مجاز نیست" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      activeRole: role,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "خطا در تغییر نقش" },
      { status: 500 }
    );
  }
}
