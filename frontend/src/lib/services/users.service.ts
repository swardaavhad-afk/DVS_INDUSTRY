import api, { unwrap } from '../api';

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

export interface RoleDto { id: number; name: string; description: string | null }

export async function getRoles(): Promise<RoleDto[]> {
  const res = await api.get<{ success: true; data: RoleDto[] }>('/auth/roles');
  return unwrap(res);
}
