import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as DepartmentController from '../controllers/department.controller';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentIdParamSchema,
  departmentQuerySchema,
} from '../validators/department.validator';
import { ROLES } from '../constants';

const router = Router();

// All department routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/departments
 * Create a new department.
 * Access: ADMIN, HR
 */
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.HR),
  validateRequest({ body: createDepartmentSchema }),
  asyncHandler(DepartmentController.createDepartment),
);

/**
 * GET /api/v1/departments
 * List all departments with search, filter, sort, pagination.
 * Access: All authenticated roles
 * Query: ?page ?pageSize ?search ?sortBy ?sortOrder ?status
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.STORE, ROLES.PRODUCTION, ROLES.SALES),
  validateRequest({ query: departmentQuerySchema }),
  asyncHandler(DepartmentController.getAllDepartments),
);

/**
 * GET /api/v1/departments/:id
 * Get a single department by ID.
 * Access: All authenticated roles
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.STORE, ROLES.PRODUCTION, ROLES.SALES),
  validateRequest({ params: departmentIdParamSchema }),
  asyncHandler(DepartmentController.getDepartmentById),
);

/**
 * PATCH /api/v1/departments/:id
 * Update department fields.
 * Access: ADMIN, HR
 */
router.patch(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.HR),
  validateRequest({
    params: departmentIdParamSchema,
    body: updateDepartmentSchema,
  }),
  asyncHandler(DepartmentController.updateDepartment),
);

/**
 * DELETE /api/v1/departments/:id
 * Soft-delete a department (sets deletedAt, isActive=false).
 * Access: ADMIN only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  validateRequest({ params: departmentIdParamSchema }),
  asyncHandler(DepartmentController.deleteDepartment),
);

/**
 * PATCH /api/v1/departments/:id/restore
 * Restore a soft-deleted department.
 * Access: ADMIN only
 */
router.patch(
  '/:id/restore',
  authorize(ROLES.ADMIN),
  validateRequest({ params: departmentIdParamSchema }),
  asyncHandler(DepartmentController.restoreDepartment),
);

export default router;
