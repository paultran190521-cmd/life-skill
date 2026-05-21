import { createHmac, timingSafeEqual } from "node:crypto";

type ConfirmationPayload = {
  scheduleId: string;
  teacherId: string;
  exp: number;
};

export function createScheduleConfirmationToken(scheduleId: string, teacherId: string) {
  const payload: ConfirmationPayload = {
    scheduleId,
    teacherId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyScheduleConfirmationToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as ConfirmationPayload;
    if (!payload.scheduleId || !payload.teacherId || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  const secret = process.env.AUTH_SECRET || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET.");
  }
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}
