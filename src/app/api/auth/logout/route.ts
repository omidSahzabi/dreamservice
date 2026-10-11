import { NextResponse } from "next/server";
import { invalidateSession } from "@/lib/auth/session";

export async function POST() {
  try {
    await invalidateSession();
    return NextResponse.json({
      success: true,
      message: "با موفقیت خارج شدید",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "خطا در فرایند خروج" },
      { status: 500 }
    );
  }
}
