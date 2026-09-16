import api, { unwrap } from '../api';

export interface ReportQuery {
  fromDate?: string;
  toDate?: string;
  departmentId?: number;
}

export async function getInventoryReport(params?: ReportQuery) {
  const res = await api.get<{ success: true; data: unknown }>('/reports/inventory', { params });
  return unwrap(res);
}

export async function getWorkforceReport(params?: ReportQuery) {
  const res = await api.get<{ success: true; data: unknown }>('/reports/workforce', { params });
  return unwrap(res);
}

export async function getOrdersReport(params?: ReportQuery) {
  const res = await api.get<{ success: true; data: unknown }>('/reports/orders', { params });
  return unwrap(res);
}

export async function getScrapReport(params?: ReportQuery) {
  const res = await api.get<{ success: true; data: unknown }>('/reports/scrap', { params });
  return unwrap(res);
}

export async function getSupplierReport(params?: ReportQuery) {
  const res = await api.get<{ success: true; data: unknown }>('/reports/suppliers', { params });
  return unwrap(res);
}

export async function getClientReport(params?: ReportQuery) {
  const res = await api.get<{ success: true; data: unknown }>('/reports/clients', { params });
  return unwrap(res);
}

export async function getAttendanceReport(params?: ReportQuery & { sortBy?: string; sortOrder?: string }) {
  const res = await api.get<{ success: true; data: unknown }>('/reports/attendance', { params });
  return unwrap(res);
}

export async function getProductionReport(params?: ReportQuery) {
  const res = await api.get<{ success: true; data: unknown }>('/reports/production', { params });
  return unwrap(res);
}
