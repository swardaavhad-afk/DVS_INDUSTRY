import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as WorkforceController from '../controllers/workforce.controller';
import {
  createShiftSchema,
  updateShiftSchema,
  shiftIdParamSchema,
  shiftQuerySchema,
  createAttendanceSchema,
  updateAttendanceSchema,
  attendanceIdParamSchema,
  attendanceQuerySchema,
  clockInSchema,
  clockOutSchema,
  bulkAttendanceSchema,
  attendanceSummarySchema,
  attendanceTrendSchema,
} from '../validators/workforce.validator';
import { ROLES } from '../constants';

const router = Router();
router.use(authenticate);

// ── Role groups ───────────────────────────────────────────────────────────────
const ALL_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.HR,
  ROLES.STORE,
  ROLES.PRODUCTION,
  ROLES.SALES,
] as const;
const WRITE_ROLES = [ROLES.ADMIN, ROLES.HR] as const;
const ADMIN_ONLY = [ROLES.ADMIN] as const;
const HR_MGR = [ROLES.ADMIN, ROLES.MANAGER, ROLES.HR] as const;

// ════════════════════════════════════════════════════════════════
// SHIFTS
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/workforce/shifts
 * List all shifts.
 * Access: All roles
 */
router.get(
  '/shifts',
  authorize(...ALL_ROLES),
  validateRequest({ query: shiftQuerySchema }),
  asyncHandler(WorkforceController.getAllShifts),
);

/**
 * POST /api/v1/workforce/shifts
 * Create a new shift.
 * Access: ADMIN, HR
 */
router.post(
  '/shifts',
  authorize(...WRITE_ROLES),
  validateRequest({ body: createShiftSchema }),
  asyncHandler(WorkforceController.createShift),
);

/**
 * GET /api/v1/workforce/shifts/:id
 * Get shift by ID.
 * Access: All roles
 */
router.get(
  '/shifts/:id',
  authorize(...ALL_ROLES),
  validateRequest({ params: shiftIdParamSchema }),
  asyncHandler(WorkforceController.getShiftById),
);

/**
 * PATCH /api/v1/workforce/shifts/:id
 * Update shift details.
 * Access: ADMIN, HR
 */
router.patch(
  '/shifts/:id',
  authorize(...WRITE_ROLES),
  validateRequest({ params: shiftIdParamSchema, body: updateShiftSchema }),
  asyncHandler(WorkforceController.updateShift),
);

/**
 * DELETE /api/v1/workforce/shifts/:id
 * Delete a shift (only if no employees assigned).
 * Access: ADMIN only
 */
router.delete(
  '/shifts/:id',
  authorize(...ADMIN_ONLY),
  validateRequest({ params: shiftIdParamSchema }),
  asyncHandler(WorkforceController.deleteShift),
);

// ════════════════════════════════════════════════════════════════
// ATTENDANCE — SUMMARY & TREND (before /:id to avoid conflicts)
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/workforce/attendance/summary
 * Daily attendance summary — KPIs + by department breakdown.
 * Query: ?date ?departmentId
 * Access: ADMIN, MANAGER, HR
 */
router.get(
  '/attendance/summary',
  authorize(...HR_MGR),
  validateRequest({ query: attendanceSummarySchema }),
  asyncHandler(WorkforceController.getDailySummary),
);

/**
 * GET /api/v1/workforce/attendance/trend
 * Attendance trend for last N days (7 or 30).
 * Query: ?days ?departmentId
 * Access: ADMIN, MANAGER, HR
 */
router.get(
  '/attendance/trend',
  authorize(...HR_MGR),
  validateRequest({ query: attendanceTrendSchema }),
  asyncHandler(WorkforceController.getAttendanceTrend),
);

/**
 * POST /api/v1/workforce/attendance/bulk
 * Mark attendance for multiple employees at once.
 * Body: { date, entries: [{ employeeId, status, clockIn?, clockOut?, remarks? }] }
 * Access: ADMIN, HR
 */
router.post(
  '/attendance/bulk',
  authorize(...WRITE_ROLES),
  validateRequest({ body: bulkAttendanceSchema }),
  asyncHandler(WorkforceController.bulkMarkAttendance),
);

/**
 * POST /api/v1/workforce/attendance/clock-in
 * Record clock-in for an employee (upserts today's record).
 * Body: { employeeId, clockIn?, remarks? }
 * Access: ADMIN, HR, PRODUCTION
 */
router.post(
  '/attendance/clock-in',
  authorize(ROLES.ADMIN, ROLES.HR, ROLES.PRODUCTION),
  validateRequest({ body: clockInSchema }),
  asyncHandler(WorkforceController.clockIn),
);

// ════════════════════════════════════════════════════════════════
// ATTENDANCE — CRUD
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/workforce/attendance
 * List attendance records with filters.
 * Query: ?employeeId ?departmentId ?status ?date ?fromDate ?toDate ?page ?pageSize
 * Access: ADMIN, MANAGER, HR
 */
router.get(
  '/attendance',
  authorize(...HR_MGR),
  validateRequest({ query: attendanceQuerySchema }),
  asyncHandler(WorkforceController.getAllAttendance),
);

/**
 * POST /api/v1/workforce/attendance
 * Create / upsert a single attendance record.
 * Access: ADMIN, HR
 */
router.post(
  '/attendance',
  authorize(...WRITE_ROLES),
  validateRequest({ body: createAttendanceSchema }),
  asyncHandler(WorkforceController.createAttendance),
);

/**
 * GET /api/v1/workforce/attendance/:id
 * Get a single attendance record by ID.
 * Access: ADMIN, MANAGER, HR
 */
router.get(
  '/attendance/:id',
  authorize(...HR_MGR),
  validateRequest({ params: attendanceIdParamSchema }),
  asyncHandler(WorkforceController.getAttendanceById),
);

/**
 * PATCH /api/v1/workforce/attendance/:id
 * Update an attendance record.
 * Access: ADMIN, HR
 */
router.patch(
  '/attendance/:id',
  authorize(...WRITE_ROLES),
  validateRequest({ params: attendanceIdParamSchema, body: updateAttendanceSchema }),
  asyncHandler(WorkforceController.updateAttendance),
);

/**
 * DELETE /api/v1/workforce/attendance/:id
 * Delete an attendance record.
 * Access: ADMIN only
 */
router.delete(
  '/attendance/:id',
  authorize(...ADMIN_ONLY),
  validateRequest({ params: attendanceIdParamSchema }),
  asyncHandler(WorkforceController.deleteAttendance),
);

/**
 * PATCH /api/v1/workforce/attendance/:id/clock-out
 * Record clock-out for an existing attendance record.
 * Body: { clockOut?, remarks? }
 * Access: ADMIN, HR, PRODUCTION
 */
router.patch(
  '/attendance/:id/clock-out',
  authorize(ROLES.ADMIN, ROLES.HR, ROLES.PRODUCTION),
  validateRequest({ params: attendanceIdParamSchema, body: clockOutSchema }),
  asyncHandler(WorkforceController.clockOut),
);

export default router;
