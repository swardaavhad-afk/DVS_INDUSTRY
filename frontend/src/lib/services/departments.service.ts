import api, { unwrap, unwrapPaged, type PaginatedMeta } from '../api';

export interface DepartmentDto {
  id:          number;
  name:        string;
  code:        string;
  description: string | null;
  managerId:   number | null;
  isActive:    boolean;
  createdAt:   string;
  updatedAt:   string;
}

export async function getDepartments(params?: { page?: number; pageSize?: number; search?: string }) {
  const res = await api.get<{ success: true; data: DepartmentDto[]; meta: PaginatedMeta }>(
    '/departments', { params: { pageSize: 100, ...params } }
  );
  return unwrapPaged(res).data;
}

export async function getDepartmentById(id: number): Promise<DepartmentDto> {
  const res = await api.get<{ success: true; data: DepartmentDto }>(`/departments/${id}`);
  return unwrap(res);
}

export async function createDepartment(payload: { name: string; code: string; description?: string | null }): Promise<DepartmentDto> {
  const res = await api.post<{ success: true; data: DepartmentDto }>('/departments', payload);
  return unwrap(res);
}

export async function updateDepartment(id: number, payload: Record<string, unknown>): Promise<DepartmentDto> {
  const res = await api.patch<{ success: true; data: DepartmentDto }>(`/departments/${id}`, payload);
  return unwrap(res);
}

export async function deleteDepartment(id: number): Promise<void> {
  await api.delete(`/departments/${id}`);
}
