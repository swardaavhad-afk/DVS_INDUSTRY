import type { Request, Response } from 'express';
import { AuditRepository } from '../repositories/audit.repository';
import { sendSuccess } from '../utils/response';
import { NotFoundError } from '../errors';
import type { AuditQueryInput } from '../validators/audit.validator';
import type { AuditLogFilters, AuditAction } from '../interfaces';

const repo = new AuditRepository();

function parseId(raw: string | string[] | undefined): number {
  return parseInt(String(raw ?? '0'), 10);
}

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as AuditQueryInput;

  const filters: AuditLogFilters = {
    page:      q.page,
    pageSize:  q.pageSize,
    sortOrder: q.sortOrder,
    action:    q.action as AuditAction | 'all',
  };
  if (q.userId   !== undefined) filters.userId   = q.userId;
  if (q.entity   !== undefined) filters.entity   = q.entity;
  if (q.entityId !== undefined) filters.entityId = q.entityId;
  if (q.search   !== undefined) filters.search   = q.search;
  if (q.fromDate !== undefined) filters.fromDate = q.fromDate;
  if (q.toDate   !== undefined) filters.toDate   = q.toDate;

  const { data, total } = await repo.findAll(filters);
  const page     = q.page     ?? 1;
  const pageSize = q.pageSize ?? 20;
  sendSuccess(res, data, 200, undefined, {
    page, pageSize, total, totalPages: Math.ceil(total / pageSize),
  });
}

export async function getAuditLogById(req: Request, res: Response): Promise<void> {
  const id  = parseId(req.params['id']);
  const log = await repo.findById(id);
  if (log === null) throw new NotFoundError(`Audit log entry ${id} not found`);
  sendSuccess(res, log);
}
