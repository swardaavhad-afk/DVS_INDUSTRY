import type { IRefreshTokenRepository } from '../interfaces';
import { prisma } from '../lib/prismaClient';

export class RefreshTokenRepository implements IRefreshTokenRepository {
  async create(data: {
    token: string;
    userId: number;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.refreshToken.create({ data });
  }

  async findByToken(
    token: string,
  ): Promise<{ id: number; userId: number; expiresAt: Date } | null> {
    const record = await prisma.refreshToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true },
    });
    return record ?? null;
  }

  async deleteByToken(token: string): Promise<void> {
    await prisma.refreshToken.delete({ where: { token } }).catch(() => {
      // Silently ignore if token was already deleted (idempotent logout)
    });
  }

  async deleteAllByUserId(userId: number): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
