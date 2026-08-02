/**
 * emailTemplates.ts — HTML + plain-text email templates for auth flows.
 *
 * Templates use inline CSS for maximum email client compatibility.
 * Plain-text versions are included as fallbacks.
 */

// ─── Shared design tokens ─────────────────────────────────────────────────────
const BRAND_GREEN = "#10B981";
const BRAND_DARK  = "#0F172A";
const BODY_BG     = "#0F172A";
const CARD_BG     = "#1E293B";
const TEXT_LIGHT  = "#F1F5F9";
const TEXT_MUTED  = "#94A3B8";
const BORDER      = "#334155";

const baseWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>AgroLoop</title>
</head>
<body style="margin:0;padding:0;background-color:${BODY_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" style="max-width:560px;width:100%;" cellspacing="0" cellpadding="0" border="0">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="display:inline-block;background:linear-gradient(135deg,${BRAND_GREEN},#059669);border-radius:16px;padding:14px 18px;font-size:28px;line-height:1;">🧅</div>
              <h1 style="color:${TEXT_LIGHT};font-size:24px;font-weight:800;margin:12px 0 4px 0;">AgroLoop</h1>
              <p style="color:${TEXT_MUTED};font-size:13px;margin:0;">Zero-Waste Onion Supply Chain</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:${CARD_BG};border-radius:16px;border:1px solid ${BORDER};overflow:hidden;">
              <div style="padding:40px 36px;">
                ${content}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="color:${TEXT_MUTED};font-size:12px;margin:0;line-height:1.6;">
                This email was sent by AgroLoop. If you didn't request this, you can safely ignore it.<br/>
                &copy; ${new Date().getFullYear()} AgroLoop. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

const ctaButton = (href: string, label: string) =>
  `<a href="${href}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,${BRAND_GREEN},#059669);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">${label}</a>`;

// ─── Email Verification Template ──────────────────────────────────────────────

interface VerificationEmailData {
  name: string;
  verificationUrl: string;
  expiryHours: number;
}

export const verificationEmailTemplate = (data: VerificationEmailData) => {
  const { name, verificationUrl, expiryHours } = data;

  const html = baseWrapper(`
    <h2 style="color:${TEXT_LIGHT};font-size:22px;font-weight:700;margin:0 0 8px 0;">Verify your email address</h2>
    <p style="color:${TEXT_MUTED};font-size:14px;margin:0 0 24px 0;">Hi ${name}, welcome to AgroLoop! 👋</p>

    <p style="color:${TEXT_LIGHT};font-size:14px;line-height:1.7;margin:0 0 32px 0;">
      Please verify your email address to activate your account and start using the platform.
      This link is valid for <strong style="color:${BRAND_GREEN};">${expiryHours} hours</strong>.
    </p>

    <div style="text-align:center;margin-bottom:32px;">
      ${ctaButton(verificationUrl, "Verify Email Address")}
    </div>

    <div style="background:${BRAND_DARK};border-radius:10px;padding:16px;border:1px solid ${BORDER};">
      <p style="color:${TEXT_MUTED};font-size:12px;margin:0 0 6px 0;">Or copy this link into your browser:</p>
      <p style="color:${BRAND_GREEN};font-size:12px;margin:0;word-break:break-all;">${verificationUrl}</p>
    </div>

    <p style="color:${TEXT_MUTED};font-size:12px;margin:24px 0 0 0;">
      If you didn't create an AgroLoop account, please ignore this email.
    </p>
  `);

  const text = `
Hi ${name},

Welcome to AgroLoop! Please verify your email address:

${verificationUrl}

This link expires in ${expiryHours} hours.

If you didn't create an account, please ignore this email.
  `.trim();

  return { html, text, subject: "Verify your AgroLoop email address" };
};

// ─── Password Reset Template ──────────────────────────────────────────────────

interface ResetEmailData {
  name: string;
  resetUrl: string;
  expiryMinutes: number;
}

export const resetPasswordEmailTemplate = (data: ResetEmailData) => {
  const { name, resetUrl, expiryMinutes } = data;

  const html = baseWrapper(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(239,68,68,0.1);border-radius:50%;font-size:24px;">🔒</div>
    </div>

    <h2 style="color:${TEXT_LIGHT};font-size:22px;font-weight:700;margin:0 0 8px 0;text-align:center;">Reset your password</h2>
    <p style="color:${TEXT_MUTED};font-size:14px;margin:0 0 24px 0;text-align:center;">Hi ${name},</p>

    <p style="color:${TEXT_LIGHT};font-size:14px;line-height:1.7;margin:0 0 32px 0;">
      We received a request to reset your password. Click the button below to choose a new one.
      This link will expire in <strong style="color:#EF4444;">${expiryMinutes} minutes</strong> and can only be used once.
    </p>

    <div style="text-align:center;margin-bottom:32px;">
      ${ctaButton(resetUrl, "Reset Password")}
    </div>

    <div style="background:${BRAND_DARK};border-radius:10px;padding:16px;border:1px solid ${BORDER};">
      <p style="color:${TEXT_MUTED};font-size:12px;margin:0 0 6px 0;">Or copy this link into your browser:</p>
      <p style="color:${BRAND_GREEN};font-size:12px;margin:0;word-break:break-all;">${resetUrl}</p>
    </div>

    <div style="border-top:1px solid ${BORDER};margin-top:28px;padding-top:20px;">
      <p style="color:${TEXT_MUTED};font-size:12px;margin:0;line-height:1.6;">
        ⚠️ If you didn't request a password reset, please ignore this email.
        Your password will remain unchanged.
        For security, this link expires in <strong>${expiryMinutes} minutes</strong>.
      </p>
    </div>
  `);

  const text = `
Hi ${name},

We received a request to reset your AgroLoop password.

Reset link (expires in ${expiryMinutes} minutes):
${resetUrl}

If you didn't request a password reset, you can safely ignore this email.
  `.trim();

  return { html, text, subject: "Reset your AgroLoop password" };
};
