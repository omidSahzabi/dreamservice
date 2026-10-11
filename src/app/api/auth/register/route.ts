import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeEmail } from "@/lib/auth/helper";
import { createSession } from "@/lib/auth/session";
import { OtpChannel } from "@prisma/client";

const registerSchema = z.object({
  contact: z.string().min(1),
  fname: z.string().min(2, "نام باید حداقل ۲ کاراکتر باشد"),
  lname: z.string().min(2, "نام خانوادگی باید حداقل ۲ کاراکتر باشد"),
  email: z.string().optional().or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_INPUT",
          error: "اطلاعات ارسالی نامعتبر است",
        },
        { status: 422 }
      );
    }

    const { contact, fname, lname, email } = result.data;
    let phone: string;
    try {
      phone = normalizePhone(contact);
    } catch {
      return NextResponse.json({success: false, code: "INVALID_PHONE", error: "شماره همراه نامعتبر است"}, {status: 400});
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, code: "INVALID_PHONE", error: "شماره همراه نامعتبر است" },
        { status: 400 }
      );
    }

    const verifiedOtp = await prisma.otpVerification.findFirst({
      where: {
        target: phone,
        channel: OtpChannel.PHONE,
        consumedAt: { not: null },
      },
      orderBy: { consumedAt: "desc" },
    });

    const isRecentlyVerified =
      verifiedOtp &&
      verifiedOtp.consumedAt &&
      Date.now() - verifiedOtp.consumedAt.getTime() < 15 * 60 * 1000;

    if (!isRecentlyVerified) {
      return NextResponse.json(
        {
          success: false,
          code: "REGISTRATION_EXPIRED", error: "شماره تماس تایید نشده یا مهلت ثبت نام منقضی شده است",
        },
        { status: 403 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { contact: phone },
    });

    if (existingUser) {
      await createSession(existingUser.id);

      return NextResponse.json({
        success: true,
        user: {
          id: existingUser.id,
          fname: existingUser.fname,
          lname: existingUser.lname,
          contact: existingUser.contact,
        },
      });
    }

    let parsedEmail: string | null = null;

    if (email && email.trim() !== "") {
      try {
        parsedEmail = normalizeEmail(email);
      } catch {
        return NextResponse.json({success: false, code: "EMAIL_INVALID", error: "ایمیل وارد شده نامعتبر است"}, {status: 400});
      }

      if (!parsedEmail) {
        return NextResponse.json(
          { success: false, code: "EMAIL_INVALID", error: "ایمیل وارد شده نامعتبر است" },
          { status: 400 }
        );
      }
    }

    const newUser = await prisma.user.create({
      data: {
        contact: phone,
        fname,
        lname,
        email: parsedEmail,
      },
    });

    await createSession(newUser.id);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        fname: newUser.fname,
        lname: newUser.lname,
        contact: newUser.contact,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, code: "REGISTER_FAILED", error: "خطا در ثبت نام کاربر" },
      { status: 500 }
    );
  }
}