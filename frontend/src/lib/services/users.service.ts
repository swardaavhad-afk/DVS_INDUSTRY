import api, { unwrap, unwrapPaged, type PaginatedMeta } from '../api';

export interface UserDto {
  id:        number;
  fullName:  string;
  email:     string;
  phone:     string | null;
  roleId:    number;
  role:      { id: number; name: string; description: string | null };
  isActive:  boolean;
  lastLogin: string | null;
  createdAt: string;
  employee:  { id: number; employeeCode: string } | null;
}

export async function getUsers(params?: { page?: number; pageSize?: number; search?: string; roleId?: number; isActive?: boolean }) {
  const res = await api.get<{ success: true; data: UserDto[]; meta: PaginatedMeta }>('/auth/users', { params });
  return unwrapPaged(res);
}

export async function createUser(payload: { fullName: string; email: string; password: string; roleId: number; phone?: string }): Promise<UserDto> {
  const res = await api.post<{ success: true; data: UserDto }>('/auth/users', payload);
  return unwrap(res);
}

export async function updateUserRole(id: number, roleId: number): Promise<UserDto> {
  const res = await api.patch<{ success: true; data: UserDto }>(`/auth/users/${id}/role`, { roleId });
  return unwrap(res);
}

export async function toggleUserActive(id: number): Promise<UserDto> {
  const res = await api.patch<{ success: true; data: UserDto }>(`/auth/users/${id}/toggle`);
  return unwrap(res);
}

export interface RoleDto { id: number; name: string; description: string | null }

export async function getRoles(): Promise<RoleDto[]> {
  const res = await api.get<{ success: true; data: RoleDto[] }>('/auth/roles');
  return unwrap(res);
}
