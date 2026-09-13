interface SendOtpParams {
  to: string;
  code: string;
}

interface FarazSmsResponse {
  status?: string;
  code?: number;
  message?: string;
  data?: any;
}

export async function sendOtpSms({ to, code }: SendOtpParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.FARAZSMS_API_KEY;
  const patternCode = process.env.FARAZSMS_PATTERN_CODE;
  const sender = process.env.FARAZSMS_SENDER_NUMBER;

  if (!apiKey || !patternCode || !sender) {
    console.error("[FarazSMS] Missing environment variables in .env");
    return { success: false, error: "SMS configuration is missing" };
  }

  const normalizedPhone = to.startsWith("+98")
    ? `0${to.slice(3)}`
    : to.startsWith("98")
    ? `0${to.slice(2)}`
    : to;

  try {
    const response = await fetch("https://edge.ippanel.com/api/v1/sms/pattern/normal/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify({
        code: patternCode,
        sender: sender,
        recipient: normalizedPhone,
        variable: {
          code: code,
        },
      }),
    });

    const data: FarazSmsResponse = await response.json();

    if (!response.ok) {
      console.error("[FarazSMS API Error]:", data);
      return { success: false, error: data.message || "Failed to send SMS" };
    }

    return { success: true };
  } catch (error) {
    console.error("[FarazSMS Exception]:", error);
    return { success: false, error: "Network error sending SMS" };
  }
}
