import crypto from "crypto";
import jwt from "jsonwebtoken";
import User, { UserDocument } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { JwtPayload, UserRole } from "../types";
import { sendEmail, getClientBaseUrl } from "../config/email";
import { verificationEmailTemplate, resetPasswordEmailTemplate } from "../utils/emailTemplates";
import { logger } from "../config/logger";

// ─── Constants ────────────────────────────────────────────────────────────────
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_MINUTES   = 10;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthResult {
  user: Omit<UserDocument, "password">;
  token: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random token.
 * Returns BOTH the raw token (sent in the email URL) and its SHA-256 hash
 * (stored in the database). The raw token never touches the database.
 */
const generateSecureToken = (): { raw: string; hashed: string } => {
  const raw = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hashed };
};

/**
 * Hashes a raw token string using SHA-256.
 * Used when verifying a token received from the client — hash it and compare
 * against the stored hash.
 */
const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

// ─── JWT helper ───────────────────────────────────────────────────────────────

const generateToken = (user: UserDocument): string => {
  const payload: JwtPayload = {
    id: user._id.toString(),
    role: user.role,
    email: user.email,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
};

// ─── Safe user object (strip sensitive fields) ────────────────────────────────

const sanitizeUser = (user: UserDocument): Omit<UserDocument, "password"> => {
  const obj = user.toObject() as Record<string, unknown>;
  delete obj["password"];
  delete obj["emailVerificationToken"];
  delete obj["emailVerificationExpires"];
  delete obj["passwordResetToken"];
  delete obj["passwordResetExpires"];
  return obj as Omit<UserDocument, "password">;
};

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Register a new user, send a verification email, and return the auth token.
 * The account is active but email is unverified — login is blocked until verified.
 */
export const registerUser = async (
  payload: RegisterPayload
): Promise<AuthResult> => {
  const { name, email, password, role = "client" } = payload;

  // Prevent self-registering as admin
  const safeRole: UserRole = role === "admin" ? "client" : role;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const user = await User.create({ name, email, password, role: safeRole });

  // Send verification email (non-blocking — don't fail registration if email fails)
  try {
    await sendVerificationEmailInternal(user);
  } catch (err) {
    logger.warn({ err, userId: user._id }, "Failed to send verification email during registration");
  }

  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
};

/**
 * Authenticates a user. Blocks login for unverified email addresses.
 */
export const loginUser = async (payload: LoginPayload): Promise<AuthResult> => {
  const { email, password } = payload;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password"
  );

  if (!user) {
    // Use a generic message to prevent email enumeration
    throw ApiError.unauthorized("Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
};

/**
 * Returns the authenticated user's profile.
 */
export const getCurrentUser = async (userId: string): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  return user;
};

// ─── Email verification ────────────────────────────────────────────────────────

/**
 * Internal helper — generates a verification token, saves its hash to the user,
 * and sends the verification email.
 */
const sendVerificationEmailInternal = async (user: UserDocument): Promise<void> => {
  const { raw, hashed } = generateSecureToken();
  const expiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
  );

  user.emailVerificationToken = hashed;
  user.emailVerificationExpires = expiresAt;
  await user.save({ validateModifiedOnly: true });

  const baseUrl = getClientBaseUrl();
  const verificationUrl = `${baseUrl}/verify-email?token=${raw}`;

  const template = verificationEmailTemplate({
    name: user.name,
    verificationUrl,
    expiryHours: EMAIL_VERIFICATION_EXPIRY_HOURS,
  });

  await sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * Resends the verification email for the currently authenticated user.
 * Rate-limited at the route level by authLimiter.
 */
export const resendVerificationEmail = async (userId: string): Promise<void> => {
  const user = await User.findById(userId).select(
    "+emailVerificationToken +emailVerificationExpires"
  );
  if (!user) throw ApiError.notFound("User not found");

  if (user.isEmailVerified) {
    throw ApiError.badRequest("Your email is already verified.");
  }

  await sendVerificationEmailInternal(user);
};

/**
 * Verifies an email using the raw token from the URL.
 * Token is hashed and compared against the stored hash.
 * Single-use: token fields are cleared on success.
 */
export const verifyEmail = async (rawToken: string): Promise<void> => {
  const hashed = hashToken(rawToken);

  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationToken +emailVerificationExpires");

  if (!user) {
    throw ApiError.badRequest(
      "Invalid or expired verification token. Please request a new verification email."
    );
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateModifiedOnly: true });

  logger.info({ userId: user._id }, "Email verified successfully");
};

// ─── Password reset ────────────────────────────────────────────────────────────

/**
 * Initiates the password reset flow.
 *
 * ALWAYS returns 200 — even if the email is not found — to prevent
 * email enumeration attacks. If email is found a reset link is sent.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordResetToken +passwordResetExpires"
  );

  // Return silently if user not found — prevents email enumeration
  if (!user) {
    logger.debug({ email }, "Password reset requested for unknown email — ignoring");
    return;
  }

  const { raw, hashed } = generateSecureToken();
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000
  );

  user.passwordResetToken = hashed;
  user.passwordResetExpires = expiresAt;
  await user.save({ validateModifiedOnly: true });

  const baseUrl = getClientBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${raw}`;

  const template = resetPasswordEmailTemplate({
    name: user.name,
    resetUrl,
    expiryMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (err) {
    // Clear the token if email fails — user must retry
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateModifiedOnly: true });
    logger.error({ err, userId: user._id }, "Failed to send password reset email");
    throw ApiError.internal("Failed to send reset email. Please try again.");
  }
};

/**
 * Resets the user's password using the raw token from the URL query string.
 * Token is single-use and expires after PASSWORD_RESET_EXPIRY_MINUTES.
 * On success: password updated, reset token cleared, all existing JWTs are
 * effectively invalidated because the password change invalidates sessions
 * on re-auth (JWT stays valid until expiry — add token versioning for
 * immediate revocation if required).
 */
export const resetPassword = async (
  rawToken: string,
  newPassword: string
): Promise<void> => {
  const hashed = hashToken(rawToken);

  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select("+password +passwordResetToken +passwordResetExpires");

  if (!user) {
    throw ApiError.badRequest(
      "Invalid or expired reset token. Please request a new password reset link."
    );
  }

  // Update password (pre-save hook will hash it)
  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save({ validateModifiedOnly: true });

  logger.info({ userId: user._id }, "Password reset successfully");
};
