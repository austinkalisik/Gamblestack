import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const secret = () => process.env.JWT_PRIVATE_KEY || "dev";

export async function signAccessToken(
  payload: Record<string, unknown>,
  expiresInSeconds = 900
): Promise<string> {
  return jwt.sign(payload, secret(), {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
  });
}

export function genRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
