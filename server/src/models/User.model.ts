import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";
import { IUser, UserRole } from "../types";

export interface UserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name cannot exceed 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never returned by default
    },
    role: {
      type: String,
      enum: ["farmer", "client", "admin"] as UserRole[],
      default: "client",
    },

    // ─── Email verification ──────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: true,
    },
    // SHA-256 hash of the raw token sent in the verification email link.
    // Never store raw tokens in the database.
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    // ─── Password reset ──────────────────────────────────────────────────────
    // SHA-256 hash of the raw token sent in the reset email link.
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);


// ─── Hash password before saving ─────────────────────────────────────────────
UserSchema.pre<UserDocument>("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password as string, salt);
});

// ─── Instance method: compare password ───────────────────────────────────────
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password as string);
};

// ─── Index ────────────────────────────────────────────────────────────────────
// Note: email already has a unique index from `unique: true` in the schema.
// Only the role index is added manually here.
UserSchema.index({ role: 1 });

const User: Model<UserDocument> = mongoose.model<UserDocument>(
  "User",
  UserSchema
);

export default User;
