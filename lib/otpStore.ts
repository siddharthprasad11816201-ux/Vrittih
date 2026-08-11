/**
 * REMOVED — this was an in-process Map holding live OTP codes in plaintext.
 *
 * It broke across serverless instances and, worse, the verify endpoint had no attempt
 * counter, so a 6-digit code could simply be brute-forced. OTPs now live in the
 * OtpChallenge table: cryptographically random, hashed at rest, single-use and
 * attempt-limited. See lib/auth/otp.ts.
 */
export {}
