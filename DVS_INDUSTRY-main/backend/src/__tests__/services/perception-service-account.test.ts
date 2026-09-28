import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedPerceptionServiceAccount } from '../../../prisma/seed-perception-service';

const makePrisma = () => ({
  user: {
    upsert: vi.fn().mockResolvedValue({ email: 'perception@example.test' }),
  },
});

describe('seedPerceptionServiceAccount', () => {
  beforeEach(() => {
    vi.stubEnv('SEED_PERCEPTION_SERVICE_EMAIL', 'perception@example.test');
    vi.stubEnv('SEED_PERCEPTION_SERVICE_PASSWORD', 'ServicePass!123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('upserts an idempotent account with the dedicated security-write role', async () => {
    const prisma = makePrisma();

    await seedPerceptionServiceAccount(prisma as never, 42);
    await seedPerceptionServiceAccount(prisma as never, 42);

    expect(prisma.user.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'perception@example.test' },
        update: expect.objectContaining({ roleId: 42, isActive: true }),
        create: expect.objectContaining({ roleId: 42, isActive: true }),
      }),
    );
    const input = prisma.user.upsert.mock.calls[0][0];
    expect(input.create.password).not.toBe('ServicePass!123');
  });

  it('skips safely when service credentials are absent', async () => {
    vi.stubEnv('SEED_PERCEPTION_SERVICE_EMAIL', '');
    vi.stubEnv('SEED_PERCEPTION_SERVICE_PASSWORD', '');
    const prisma = makePrisma();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(seedPerceptionServiceAccount(prisma as never, 42)).resolves.toBe(false);

    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(' ')).not.toContain('ServicePass!123');
  });
});
