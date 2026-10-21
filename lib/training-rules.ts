export const CORRECTION_UNLOCK_ATTEMPTS = 3;

export function isCorrectionUnlocked(attemptCount: number) {
  return attemptCount >= CORRECTION_UNLOCK_ATTEMPTS;
}

export function remainingCorrectionAttempts(attemptCount: number) {
  return Math.max(0, CORRECTION_UNLOCK_ATTEMPTS - attemptCount);
}
