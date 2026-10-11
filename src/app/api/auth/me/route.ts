import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, user: null },
        { status: 200 }
      );
    }

    const { id, fname, lname, contact, email, roles, profiles } = user;
    return NextResponse.json({
      success: true,
      user: { id, fname, lname, contact, email, roles, profiles },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "خطا در دریافت اطلاعات کاربر" },
      { status: 500 }
    );
  }
}
