/**
 * email.ts — Nodemailer transporter factory.
 *
 * The transporter is created lazily once and reused across calls.
 * If SMTP credentials are not configured the module warns once and all
 * sendEmail() calls resolve successfully without sending anything —
 * preventing crashes during local development.
 *
 * SMTP configuration (add to .env):
 *
 *   # Gmail (use an App Password — not your account password)
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your@gmail.com
 *   SMTP_PASS=your-16-char-app-password
 *   SMTP_FROM=AgroLoop <your@gmail.com>
 *
 *   # SendGrid
 *   SMTP_HOST=smtp.sendgrid.net
 *   SMTP_PORT=587
 *   SMTP_USER=apikey
 *   SMTP_PASS=SG.xxxxxxxxxxxx
 *
 *   # Resend SMTP
 *   SMTP_HOST=smtp.resend.com
 *   SMTP_PORT=587
 *   SMTP_USER=resend
 *   SMTP_PASS=re_xxxxxxxxxxxx
 */
import nodemailer, { Transporter } from "nodemailer";
import { env } from "./env";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string; // plain-text fallback
}

// ─── Singleton transporter ────────────────────────────────────────────────────
let _transporter: Transporter | null = null;
let _smtpWarned = false;

const getTransporter = (): Transporter | null => {
  if (_transporter) return _transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    if (!_smtpWarned && env.NODE_ENV !== "test") {
      logger.warn(
        "⚠️  SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing) — " +
        "emails will be skipped. Set these variables to enable email sending."
      );
      _smtpWarned = true;
    }
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT, 10),
    secure: parseInt(env.SMTP_PORT, 10) === 465, // true for 465, STARTTLS for 587
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return _transporter;
};

// ─── Send function ────────────────────────────────────────────────────────────
/**
 * Sends a transactional email.
 *
 * - Resolves with `{ sent: true }` on success.
 * - Resolves with `{ sent: false }` when SMTP is not configured (dev mode).
 * - Throws if the SMTP server rejects the message.
 */
export const sendEmail = async (payload: EmailPayload): Promise<{ sent: boolean }> => {
  const transporter = getTransporter();

  if (!transporter) {
    // Dev / test mode — log the email content to the console for inspection
    if (env.NODE_ENV === "development") {
      logger.debug(
        { to: payload.to, subject: payload.subject },
        "📧 [DEV] Email not sent (SMTP unconfigured) — content logged below"
      );
      logger.debug(payload.text);
    }
    return { sent: false };
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  logger.info({ to: payload.to, subject: payload.subject }, "📧 Email sent");
  return { sent: true };
};

// ─── Helper: resolve frontend base URL ───────────────────────────────────────
/**
 * Returns the URL to use in email links pointing at the frontend.
 * Uses CLIENT_RESET_URL if set, otherwise falls back to the first
 * origin in CLIENT_URL (which may be a comma-separated list).
 */
export const getClientBaseUrl = (): string =>
  env.CLIENT_RESET_URL ?? env.CLIENT_URL.split(",")[0].trim();
