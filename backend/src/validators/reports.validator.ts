import { z } from 'zod';

// Shared date range query used by all report endpoints
export const reportQuerySchema = z.object({
  fromDate:     z.coerce.date().optional(),
  toDate:       z.coerce.date().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  format:       z.enum(['json']).optional().default('json'),
});

// Attendance report — same date range + department scope, with optional sortBy
export const attendanceReportQuerySchema = z.object({
  fromDate:     z.coerce.date().optional(),
  toDate:       z.coerce.date().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  sortBy:       z.enum(['name', 'department', 'attendanceRate', 'totalDays'])
                  .optional()
                  .default('department'),
  sortOrder:    z.enum(['asc', 'desc']).optional().default('asc'),
  format:       z.enum(['json']).optional().default('json'),
});

export type ReportQueryInput           = z.infer<typeof reportQuerySchema>;
export type AttendanceReportQueryInput = z.infer<typeof attendanceReportQuerySchema>;
