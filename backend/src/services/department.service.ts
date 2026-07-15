import { DepartmentRepository } from '../repositories';
import type {
  DepartmentDto,
  DepartmentListResult,
  DepartmentFilters,
  CreateDepartmentData,
  UpdateDepartmentData,
} from '../interfaces';
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
} from '../errors';
import { logger } from '../logger';

/**
 * DepartmentService — all business rules live here.
 *
 * Business rules enforced:
 *  1. Name must be unique (case-insensitive, across ALL records including deleted)
 *  2. Code must be unique (among active records; can reuse if old was permanently gone)
 *  3. Soft-delete only — no hard deletes
 *  4. Cannot restore if another active department already owns the same code
 *  5. Cannot update a deleted department
 */
export class DepartmentService {
  private readonly repo: DepartmentRepository;

  constructor() {
    this.repo = new DepartmentRepository();
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(data: CreateDepartmentData): Promise<DepartmentDto> {
    // Rule 1 — unique name (case-insensitive, across all records)
    const nameConflict = await this.repo.findByName(data.name);
    if (nameConflict !== null) {
      throw new ConflictError(
        `A department with the name "${data.name}" already exists`,
      );
    }

    // Rule 2 — unique code (case-sensitive, uppercase enforced by validator)
    const codeConflict = await this.repo.findByCode(data.code);
    if (codeConflict !== null) {
      throw new ConflictError(
        `A department with the code "${data.code}" already exists`,
      );
    }

    const dept = await this.repo.create(data);
    logger.info('Department created', { id: dept.id, code: dept.code });
    return dept;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: number, data: UpdateDepartmentData): Promise<DepartmentDto> {
    const existing = await this.getByIdOrThrow(id);

    // Cannot modify a soft-deleted department
    if (existing.deletedAt !== null) {
      throw new BadRequestError(
        'Cannot update a deleted department. Restore it first.',
      );
    }

    // If renaming — check uniqueness against OTHER departments
    if (data.name !== undefined && data.name !== existing.name) {
      const nameConflict = await this.repo.findByName(data.name);
      if (nameConflict !== null && nameConflict.id !== id) {
        throw new ConflictError(
          `A department with the name "${data.name}" already exists`,
        );
      }
    }

    // If changing code — check uniqueness
    if (data.code !== undefined && data.code !== existing.code) {
      const codeConflict = await this.repo.findByCode(data.code);
      if (codeConflict !== null && codeConflict.id !== id) {
        throw new ConflictError(
          `A department with the code "${data.code}" already exists`,
        );
      }
    }

    const updated = await this.repo.update(id, data);
    logger.info('Department updated', { id });
    return updated;
  }

  // ── Soft Delete ───────────────────────────────────────────────────────────

  async softDelete(id: number): Promise<DepartmentDto> {
    const existing = await this.getByIdOrThrow(id);

    if (existing.deletedAt !== null) {
      throw new BadRequestError('Department is already deleted');
    }

    const deleted = await this.repo.softDelete(id);
    logger.info('Department soft-deleted', { id });
    return deleted;
  }

  // ── Restore ───────────────────────────────────────────────────────────────

  async restore(id: number): Promise<DepartmentDto> {
    const existing = await this.getByIdOrThrow(id);

    if (existing.deletedAt === null) {
      throw new BadRequestError('Department is not deleted — nothing to restore');
    }

    // Rule 4 — code uniqueness check before restore
    const codeConflict = await this.repo.findByCode(existing.code);
    if (codeConflict !== null && codeConflict.id !== id && codeConflict.isActive) {
      throw new ConflictError(
        `Cannot restore: another active department already uses the code "${existing.code}". ` +
          `Update the code before restoring.`,
      );
    }

    // Name uniqueness check before restore
    const nameConflict = await this.repo.findByName(existing.name);
    if (
      nameConflict !== null &&
      nameConflict.id !== id &&
      nameConflict.isActive
    ) {
      throw new ConflictError(
        `Cannot restore: another active department already uses the name "${existing.name}".`,
      );
    }

    const restored = await this.repo.restore(id);
    logger.info('Department restored', { id });
    return restored;
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────

  async getById(id: number): Promise<DepartmentDto> {
    return this.getByIdOrThrow(id);
  }

  // ── Get All (search / filter / sort / paginate) ───────────────────────────

  async getAll(filters: DepartmentFilters): Promise<DepartmentListResult> {
    return this.repo.findAll(filters);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getByIdOrThrow(id: number): Promise<DepartmentDto> {
    const dept = await this.repo.findById(id);
    if (dept === null) {
      throw new NotFoundError(`Department with id ${id} not found`);
    }
    return dept;
  }
}
