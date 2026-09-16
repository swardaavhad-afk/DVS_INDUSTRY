import { ProductionRepository } from '../repositories/production.repository';
import type {
  WorkOrderDto,
  WorkOrderDetail,
  WorkOrderListResult,
  WorkOrderFilters,
  CreateWorkOrderData,
  UpdateWorkOrderData,
  WorkOrderOutputDto,
  OutputListResult,
  OutputFilters,
  CreateOutputData,
  UpdateOutputData,
  ProductionKPIs,
  ProductionTrendEntry,
  WorkOrderStatus,
} from '../interfaces';
import {
  NotFoundError,
  BadRequestError,
} from '../errors';
import { logger } from '../logger';

/**
 * ProductionService — business rules:
 *
 * Work Orders:
 *  1. WO number is auto-generated; never supplied by the client
 *  2. scheduledEnd must be >= scheduledStart (enforced in validator too)
 *  3. actualEnd must be >= actualStart
 *  4. Cannot hard-delete a WO — soft-delete (sets deletedAt + CANCELLED)
 *  5. Cannot transition to an illegal status (state-machine guard)
 *  6. Marking COMPLETED sets actualEnd to now() if not provided
 *  7. Marking IN_PROGRESS sets actualStart to now() if not provided
 *
 * Outputs:
 *  8. Output can only be added to a WO that is RELEASED or IN_PROGRESS
 *  9. Output belongs to the WO it was created under (ownership check on update/delete)
 * 10. Deleting an output is always allowed (corrections)
 */

// Valid forward transitions
const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  DRAFT:       ['RELEASED', 'CANCELLED'],
  RELEASED:    ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD:     ['RELEASED', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

export class ProductionService {
  private readonly repo: ProductionRepository;

  constructor() {
    this.repo = new ProductionRepository();
  }

  // ══ WORK ORDERS ══════════════════════════════════════════════════════════

  async createWorkOrder(data: CreateWorkOrderData): Promise<WorkOrderDto> {
    const wo = await this.repo.createWorkOrder(data);
    logger.info('Work order created', { id: wo.id, workOrderNumber: wo.workOrderNumber });
    return wo;
  }

  async updateWorkOrder(id: number, data: UpdateWorkOrderData): Promise<WorkOrderDto> {
    const existing = await this.getWorkOrderOrThrow(id);

    // Rule 5 — status machine guard
    if (data.status !== undefined && data.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(data.status)) {
        throw new BadRequestError(
          `Cannot transition work order from ${existing.status} to ${data.status}. ` +
          `Allowed: ${allowed.join(', ') || 'none'}`,
        );
      }

      // Rule 6 — auto-set actualEnd on COMPLETED
      if (data.status === 'COMPLETED' && data.actualEnd === undefined) {
        data.actualEnd = new Date();
      }

      // Rule 7 — auto-set actualStart on IN_PROGRESS
      if (data.status === 'IN_PROGRESS' && !existing.actualStart && data.actualStart === undefined) {
        data.actualStart = new Date();
      }
    }

    const wo = await this.repo.updateWorkOrder(id, data);
    logger.info('Work order updated', { id, status: wo.status });
    return wo;
  }

  async getWorkOrderById(id: number): Promise<WorkOrderDto> {
    return this.getWorkOrderOrThrow(id);
  }

  async getWorkOrderDetail(id: number): Promise<WorkOrderDetail> {
    const detail = await this.repo.findWorkOrderDetail(id);
    if (detail === null) throw new NotFoundError(`Work order with id ${id} not found`);
    return detail;
  }

  async getAllWorkOrders(filters: WorkOrderFilters): Promise<WorkOrderListResult> {
    return this.repo.findAllWorkOrders(filters);
  }

  async deleteWorkOrder(id: number): Promise<void> {
    const existing = await this.getWorkOrderOrThrow(id);

    // Rule 4 — soft-delete only; rule 5 — can only cancel from non-terminal states
    if (existing.status === 'COMPLETED') {
      throw new BadRequestError(
        'Cannot delete a completed work order. Archive it manually if needed.',
      );
    }

    await this.repo.softDeleteWorkOrder(id);
    logger.info('Work order soft-deleted', { id });
  }

  // ── Status transition shortcut ────────────────────────────────────────────

  async transitionStatus(
    id: number,
    status: WorkOrderStatus,
    actualStart?: Date | null,
    actualEnd?: Date | null,
    notes?: string | null,
  ): Promise<WorkOrderDto> {
    return this.updateWorkOrder(id, {
      status,
      ...(actualStart !== undefined && { actualStart }),
      ...(actualEnd   !== undefined && { actualEnd }),
      ...(notes       !== undefined && { notes }),
    });
  }

  // ══ OUTPUTS ══════════════════════════════════════════════════════════════

  async addOutput(workOrderId: number, data: Omit<CreateOutputData, 'workOrderId'>): Promise<WorkOrderOutputDto> {
    const wo = await this.getWorkOrderOrThrow(workOrderId);

    // Rule 8 — only RELEASED or IN_PROGRESS can accept output
    if (wo.status !== 'RELEASED' && wo.status !== 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot record output for a work order with status "${wo.status}". ` +
        'Work order must be RELEASED or IN_PROGRESS.',
      );
    }

    const output = await this.repo.createOutput({ ...data, workOrderId });
    logger.info('Output recorded', { workOrderId, outputId: output.id, goodQty: output.goodQty });
    return output;
  }

  async updateOutput(
    workOrderId: number,
    outputId: number,
    data: UpdateOutputData,
  ): Promise<WorkOrderOutputDto> {
    await this.getWorkOrderOrThrow(workOrderId);
    const existing = await this.getOutputOrThrow(outputId);

    // Rule 9 — ownership check
    if (existing.workOrderId !== workOrderId) {
      throw new BadRequestError(
        `Output ${outputId} does not belong to work order ${workOrderId}`,
      );
    }

    const output = await this.repo.updateOutput(outputId, data);
    logger.info('Output updated', { workOrderId, outputId });
    return output;
  }

  async deleteOutput(workOrderId: number, outputId: number): Promise<void> {
    await this.getWorkOrderOrThrow(workOrderId);
    const existing = await this.getOutputOrThrow(outputId);

    if (existing.workOrderId !== workOrderId) {
      throw new BadRequestError(
        `Output ${outputId} does not belong to work order ${workOrderId}`,
      );
    }

    await this.repo.deleteOutput(outputId);
    logger.info('Output deleted', { workOrderId, outputId });
  }

  async getOutputsByWorkOrder(
    workOrderId: number,
    filters: Omit<OutputFilters, 'workOrderId'>,
  ): Promise<OutputListResult> {
    await this.getWorkOrderOrThrow(workOrderId);
    return this.repo.findOutputsByWorkOrder({ ...filters, workOrderId });
  }

  // ══ KPIs & TREND ═════════════════════════════════════════════════════════

  async getKPIs(
    departmentId?: number,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<ProductionKPIs> {
    return this.repo.getKPIs(departmentId, fromDate, toDate);
  }

  async getProductionTrend(
    days = 7,
    departmentId?: number,
  ): Promise<ProductionTrendEntry[]> {
    return this.repo.getProductionTrend(days, departmentId);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getWorkOrderOrThrow(id: number): Promise<WorkOrderDto> {
    const wo = await this.repo.findWorkOrderById(id);
    if (wo === null) throw new NotFoundError(`Work order with id ${id} not found`);
    return wo;
  }

  private async getOutputOrThrow(outputId: number): Promise<WorkOrderOutputDto> {
    const o = await this.repo.findOutputById(outputId);
    if (o === null) throw new NotFoundError(`Output record with id ${outputId} not found`);
    return o;
  }
}
