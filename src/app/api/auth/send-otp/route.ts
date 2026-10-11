import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpChannel, OtpPurpose } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  generateOtpCode,
  hashOtpCode,
  normalizePhone,
} from "@/lib/auth/helper";
import { sendOtpSms } from "@/lib/auth/sms";

const sendOtpSchema = z.object({
  target: z.string().min(1, "شماره موبایل الزامی است"),
  purpose: z.nativeEnum(OtpPurpose).default(OtpPurpose.LOGIN),
});

const OTP_EXPIRATION_MINUTES = 2;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = sendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "داده‌های ورودی نامعتبر است",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { target: rawTarget, purpose } = parsed.data;
    const phone = normalizePhone(rawTarget);
    const now = new Date();

    const latestOtp = await prisma.otpVerification.findFirst({
      where: {
        target: phone,
        channel: OtpChannel.PHONE,
        purpose,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    if (latestOtp) {
      const secondsSinceLastRequest = Math.floor(
        (now.getTime() - latestOtp.createdAt.getTime()) / 1000
      );

      if (secondsSinceLastRequest < OTP_RESEND_COOLDOWN_SECONDS) {
        const retryAfter =
          OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastRequest;

        return NextResponse.json(
          {
            success: false,
            error: `لطفاً ${retryAfter} ثانیه دیگر مجدداً تلاش کنید`,
            retryAfter,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
            },
          }
        );
      }
    }

    const plainCode = generateOtpCode();
    const codeHash = hashOtpCode(plainCode);
    const expiresAt = new Date(
      now.getTime() + OTP_EXPIRATION_MINUTES * 60 * 1000
    );

    if (process.env.NODE_ENV === "development") {
      console.log("========================================");
      console.log(`🔑 DEV OTP Code for [${phone}]: ${plainCode}`);
      console.log("========================================");
    } else {
      const smsResult = await sendOtpSms({
        to: phone,
        code: plainCode,
      });

      if (!smsResult.success) {
        console.error("[SEND_OTP_SMS_FAILED]", smsResult.error);

        return NextResponse.json(
          {
            success: false,
            error: "ارسال پیامک انجام نشد. لطفاً دوباره تلاش کنید.",
          },
          { status: 502 }
        );
      }
    }

    await prisma.otpVerification.create({
      data: {
        target: phone,
        channel: OtpChannel.PHONE,
        purpose,
        codeHash,
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "کد تأیید با موفقیت ارسال شد",
        expiresIn: OTP_EXPIRATION_MINUTES * 60,
        retryAfter: OTP_RESEND_COOLDOWN_SECONDS,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SEND_OTP_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "خطای داخلی سرور",
      },
      { status: 500 }
    );
  }
}
