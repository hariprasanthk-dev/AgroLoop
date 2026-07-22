import jwt from "jsonwebtoken";
import User, { UserDocument } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { JwtPayload, UserRole } from "../types";

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
  const token = generateToken(user);

  // Remove password from response
  const userObj = user.toObject() as UserDocument;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (userObj as any).password;

  return { user: userObj, token };
};

export const loginUser = async (payload: LoginPayload): Promise<AuthResult> => {
  const { email, password } = payload;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password"
  );

  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const token = generateToken(user);

  const userObj = user.toObject() as UserDocument;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (userObj as any).password;

  return { user: userObj, token };
};

export const getCurrentUser = async (userId: string): Promise<UserDocument> => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  return user;
};
