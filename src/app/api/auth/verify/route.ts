import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashOtpCode, normalizePhone } from "@/lib/auth/helper";
import { createSession } from "@/lib/auth/session";
import { OtpPurpose, OtpChannel } from "@prisma/client";

const MAX_ATTEMPTS = 5;

const verifySchema = z.object({
  target: z.string().min(1),
  code: z.string().regex(/^\d{5}$/),
  purpose: z.nativeEnum(OtpPurpose).default(OtpPurpose.LOGIN),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = verifySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, code: "INVALID_INPUT", error: "کد وارد شده معتبر نیست" },
        { status: 422 }
      );
    }

    const { target, code, purpose } = result.data;
    let phone: string;
    try {
      phone = normalizePhone(target);
    } catch {
      return NextResponse.json({success: false, code: "INVALID_PHONE", error: "شماره همراه نامعتبر است"}, {status: 400});
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, code: "INVALID_PHONE", error: "شماره تماس نامعتبر است" },
        { status: 400 }
      );
    }

    const latestOtp = await prisma.otpVerification.findFirst({
      where: {
        target: phone,
        channel: OtpChannel.PHONE,
        purpose,
        consumedAt: null,
      },
      orderBy: { id: "desc" },
    });

    if (!latestOtp) {
      return NextResponse.json(
        { success: false, code: "OTP_NOT_FOUND", error: "کد تایید منقضی شده یا درخواستی یافت نشد" },
        { status: 400 }
      );
    }

    if (new Date() > latestOtp.expiresAt) {
      return NextResponse.json(
        { success: false, code: "OTP_EXPIRED", error: "کد تایید منقضی شده است. مجددا درخواست دهید" },
        { status: 400 }
      );
    }

    if (latestOtp.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { success: false, code: "OTP_ATTEMPTS_EXCEEDED", error: "تعداد دفعات تلاش بیش از حد مجاز است. لطفا مجددا تلاش کنید" },
        { status: 429 }
      );
    }

    const hashedInput = hashOtpCode(code);

    if (latestOtp.codeHash !== hashedInput) {
      const updated = await prisma.otpVerification.update({
        where: { id: latestOtp.id },
        data: { attempts: { increment: 1 } },
      });

      const remainingAttempts = Math.max(0, MAX_ATTEMPTS - updated.attempts);

      return NextResponse.json(
        {
          success: false,
          code: "OTP_INVALID",
          error: `کد وارد شده اشتباه است. ${remainingAttempts} تلاش باقی مانده`,
          remainingAttempts,
        },
        { status: 400 }
      );
    }

    const consumeResult = await prisma.otpVerification.updateMany({
      where: {
        id: latestOtp.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });

    if (consumeResult.count === 0) {
      return NextResponse.json(
        { success: false, code: "OTP_USED", error: "کد قبلاً استفاده شده است" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { contact: phone },
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        verified: true,
        isNewUser: true,
        target: phone,
      });
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      verified: true,
      isNewUser: false,
      user: {
        id: user.id,
        fname: user.fname,
        lname: user.lname,
        contact: user.contact,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, code: "UNKNOWN", error: "خطای سرور رخ داده است" },
      { status: 500 }
    );
  }
}
