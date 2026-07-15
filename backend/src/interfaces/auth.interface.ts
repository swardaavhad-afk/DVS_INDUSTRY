// ── Domain interfaces for the Auth feature ──────────────────────────────────
// These are plain objects — no Prisma imports here.
// Services and controllers depend on these, not on Prisma types directly.

export interface RoleDto {
  id: number;
  name: string;
  description: string | null;
}

/** Safe user object — password is never included. */
export interface UserDto {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: RoleDto;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtAccessPayload {
  sub: number;   // userId
  email: string;
  role: string;  // role name
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: number;   // userId
  jti: string;   // token family / unique token id
  iat?: number;
  exp?: number;
}

// ── Repository contracts ─────────────────────────────────────────────────────

export interface IUserRepository {
  findById(id: number): Promise<UserDto | null>;
  findByEmail(email: string): Promise<(UserDto & { password: string }) | null>;
  findAll(filters?: { isActive?: boolean; roleId?: number }): Promise<UserDto[]>;
  create(data: CreateUserData): Promise<UserDto>;
  update(id: number, data: Partial<UpdateUserData>): Promise<UserDto>;
  updateLastLogin(id: number): Promise<void>;
  updatePassword(id: number, hashedPassword: string): Promise<void>;
  deactivate(id: number): Promise<UserDto>;
}

export interface IRoleRepository {
  findById(id: number): Promise<RoleDto | null>;
  findByName(name: string): Promise<RoleDto | null>;
  findAll(): Promise<RoleDto[]>;
}

export interface IRefreshTokenRepository {
  create(data: { token: string; userId: number; expiresAt: Date }): Promise<void>;
  findByToken(token: string): Promise<{ id: number; userId: number; expiresAt: Date } | null>;
  deleteByToken(token: string): Promise<void>;
  deleteAllByUserId(userId: number): Promise<void>;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateUserData {
  fullName: string;
  email: string;
  password: string;        // plain text — service will hash it
  phone?: string | null;
  roleId: number;
}

export interface UpdateUserData {
  fullName: string;
  phone: string | null;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}
