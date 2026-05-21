import { createHmac, timingSafeEqual } from "node:crypto";

export const sessionCookieName = "life_skill_session";
export const oauthStateCookieName = "life_skill_oauth_state";

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

export function createSessionToken(userId: string, email: string) {
  const payload: SessionPayload = {
    userId,
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (!payload.userId || !payload.email || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function sessionSecret() {
  const secret = process.env.AUTH_SECRET || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET.");
  }
  return secret;
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
