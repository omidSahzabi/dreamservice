import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePhone, generateOtpCode, hashOtpCode } from "@/lib/auth/helper";
import { sendOtpSms } from "@/lib/auth/sms";
import { OtpChannel, OtpPurpose } from "@prisma/client";

const sendOtpSchema = z.object({
  target: z.string().min(1, "شماره موبایل الزامی است"),
  purpose: z.nativeEnum(OtpPurpose).default(OtpPurpose.LOGIN),
});

const OTP_EXPIRATION_MINUTES = 2;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = sendOtpSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "داده‌های ورودی نامعتبر است", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { target: rawTarget, purpose } = parseResult.data;
    const phone = normalizePhone(rawTarget);

    if (!/^09\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "شماره موبایل وارد شده نامعتبر است" },
        { status: 400 }
      );
    }

    const now = new Date();

    const activeOtp = await prisma.otpVerification.findFirst({
      where: {
        target: phone,
        channel: OtpChannel.PHONE,
        purpose,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeOtp) {
      const remainingSeconds = Math.ceil(
        (activeOtp.expiresAt.getTime() - now.getTime()) / 1000
      );
      return NextResponse.json(
        {
          error: `لطفاً ${remainingSeconds} ثانیه دیگر مجدداً تلاش کنید`,
          retryAfter: remainingSeconds,
        },
        { status: 429 }
      );
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    await prisma.otpVerification.create({
      data: {
        target: phone,
        channel: OtpChannel.PHONE,
        purpose,
        codeHash,
        expiresAt,
      },
    });

    await sendOtpSms({to : phone, code});

    return NextResponse.json(
      {
        success: true,
        message: "کد تأیید با موفقیت ارسال شد",
        expiresIn: OTP_EXPIRATION_MINUTES * 60,
      },
      { status: 200 }
    );
  }  catch (error) {
  console.error("[SEND_OTP_ERROR]:", error);
  
  if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(
    { error: "خطای داخلی سرور" },
    { status: 500 }
  );
}

}
