import { z } from 'zod';

// Shared date range query used by all report endpoints
export const reportQuerySchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  format: z.enum(['json']).optional().default('json'),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
