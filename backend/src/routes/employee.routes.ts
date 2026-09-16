import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { uploadProfileImage } from '../utils/upload';
import * as EmployeeController from '../controllers/employee.controller';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdParamSchema,
  employeeQuerySchema,
  assignDepartmentSchema,
  assignManagerSchema,
  assignShiftSchema,
} from '../validators/employee.validator';
import { ROLES } from '../constants';

const router = Router();

// All employee routes require authentication
router.use(authenticate);

// ── View-only roles (all authenticated) ──────────────────────────────────────
const ALL_ROLES = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.HR,
  ROLES.STORE,
  ROLES.PRODUCTION,
  ROLES.SALES,
] as const;

// ── Write roles ───────────────────────────────────────────────────────────────
const WRITE_ROLES = [ROLES.ADMIN, ROLES.HR] as const;

// ── Admin only ────────────────────────────────────────────────────────────────
const ADMIN_ONLY = [ROLES.ADMIN] as const;

// ── Assign roles ─────────────────────────────────────────────────────────────
const ASSIGN_ROLES = [ROLES.ADMIN, ROLES.HR] as const;

/**
 * GET /api/v1/employees/statistics
 * Must be defined BEFORE /:id to avoid route collision.
 * Access: ADMIN, HR, MANAGER
 */
router.get(
  '/statistics',
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.HR),
  asyncHandler(EmployeeController.getStatistics),
);

/**
 * POST /api/v1/employees
 * Create a new employee.
 * Access: ADMIN, HR
 */
router.post(
  '/',
  authorize(...WRITE_ROLES),
  validateRequest({ body: createEmployeeSchema }),
  asyncHandler(EmployeeController.createEmployee),
);

/**
 * GET /api/v1/employees
 * List employees with search, filters, sort, pagination.
 * Access: All authenticated roles
 * Query: ?page ?pageSize ?search ?departmentId ?designation ?status
 *        ?employmentType ?shiftId ?managerId ?includeDeleted ?sortBy ?sortOrder
 */
router.get(
  '/',
  authorize(...ALL_ROLES),
  validateRequest({ query: employeeQuerySchema }),
  asyncHandler(EmployeeController.getAllEmployees),
);

/**
 * GET /api/v1/employees/:id
 * Get a single employee by ID.
 * Access: All authenticated roles
 */
router.get(
  '/:id',
  authorize(...ALL_ROLES),
  validateRequest({ params: employeeIdParamSchema }),
  asyncHandler(EmployeeController.getEmployeeById),
);

/**
 * PATCH /api/v1/employees/:id
 * Update employee profile fields.
 * Access: ADMIN, HR
 */
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validateRequest({
    params: employeeIdParamSchema,
    body: updateEmployeeSchema,
  }),
  asyncHandler(EmployeeController.updateEmployee),
);

/**
 * DELETE /api/v1/employees/:id
 * Soft-delete an employee (sets deletedAt, status → TERMINATED).
 * Access: ADMIN only
 */
router.delete(
  '/:id',
  authorize(...ADMIN_ONLY),
  validateRequest({ params: employeeIdParamSchema }),
  asyncHandler(EmployeeController.deleteEmployee),
);

/**
 * PATCH /api/v1/employees/:id/restore
 * Restore a soft-deleted employee.
 * Access: ADMIN only
 */
router.patch(
  '/:id/restore',
  authorize(...ADMIN_ONLY),
  validateRequest({ params: employeeIdParamSchema }),
  asyncHandler(EmployeeController.restoreEmployee),
);

/**
 * PATCH /api/v1/employees/:id/activate
 * Set employee status to ACTIVE.
 * Access: ADMIN, HR
 */
router.patch(
  '/:id/activate',
  authorize(...WRITE_ROLES),
  validateRequest({ params: employeeIdParamSchema }),
  asyncHandler(EmployeeController.activateEmployee),
);

/**
 * PATCH /api/v1/employees/:id/deactivate
 * Set employee status to INACTIVE.
 * Access: ADMIN, HR
 */
router.patch(
  '/:id/deactivate',
  authorize(...WRITE_ROLES),
  validateRequest({ params: employeeIdParamSchema }),
  asyncHandler(EmployeeController.deactivateEmployee),
);

/**
 * PATCH /api/v1/employees/:id/department
 * Assign or unassign a department (departmentId: null to unassign).
 * Access: ADMIN, HR
 */
router.patch(
  '/:id/department',
  authorize(...ASSIGN_ROLES),
  validateRequest({
    params: employeeIdParamSchema,
    body: assignDepartmentSchema,
  }),
  asyncHandler(EmployeeController.assignDepartment),
);

/**
 * PATCH /api/v1/employees/:id/manager
 * Assign or unassign a reporting manager (managerId: null to unassign).
 * Access: ADMIN, HR
 */
router.patch(
  '/:id/manager',
  authorize(...ASSIGN_ROLES),
  validateRequest({
    params: employeeIdParamSchema,
    body: assignManagerSchema,
  }),
  asyncHandler(EmployeeController.assignManager),
);

/**
 * PATCH /api/v1/employees/:id/shift
 * Assign or unassign a shift (shiftId: null to unassign).
 * Access: ADMIN, HR
 */
router.patch(
  '/:id/shift',
  authorize(...ASSIGN_ROLES),
  validateRequest({
    params: employeeIdParamSchema,
    body: assignShiftSchema,
  }),
  asyncHandler(EmployeeController.assignShift),
);

/**
 * POST /api/v1/employees/:id/profile-image
 * Upload or replace an employee's profile photo.
 * Content-Type: multipart/form-data, field name: "image"
 * Accepts: JPEG, PNG, WebP — max 5 MB
 * Access: ADMIN, HR
 */
router.post(
  '/:id/profile-image',
  authorize(...WRITE_ROLES),
  validateRequest({ params: employeeIdParamSchema }),
  uploadProfileImage,                          // multer middleware
  asyncHandler(EmployeeController.uploadProfileImage),
);

export default router;
