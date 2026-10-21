export type EmailVerificationResult =
  | "verified"
  | "invalid"
  | "expired"
  | "used"
  | "already_verified";

export class VerificationRateError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Aguarde antes de reenviar a confirmação.");
  }
}

export function verificationStatus(
  token: { usedAt: Date | string | null; expiresAt: Date | string },
  verified: boolean,
): EmailVerificationResult {
  if (token.usedAt) return "used";
  if (new Date(token.expiresAt).getTime() <= Date.now()) return "expired";
  return verified ? "already_verified" : "verified";
}
