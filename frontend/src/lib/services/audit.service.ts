import api, { unwrap, unwrapPaged, type PaginatedMeta } from '../api';

export interface AuditLogDto {
  id:          number;
  userId:      number | null;
  userEmail:   string | null;
  userRole:    string | null;
  action:      string;
  entity:      string;
  entityId:    string | null;
  method:      string | null;
  path:        string | null;
  statusCode:  number | null;
  ipAddress:   string | null;
  createdAt:   string;
}

export async function getAuditLogs(params?: {
  page?: number; pageSize?: number;
  userId?: number; action?: string; entity?: string;
  search?: string; fromDate?: string; toDate?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const res = await api.get<{ success: true; data: AuditLogDto[]; meta: PaginatedMeta }>(
    '/audit', { params }
  );
  return unwrapPaged(res);
}

export async function getAuditLogById(id: number): Promise<AuditLogDto> {
  const res = await api.get<{ success: true; data: AuditLogDto }>(`/audit/${id}`);
  return unwrap(res);
}
