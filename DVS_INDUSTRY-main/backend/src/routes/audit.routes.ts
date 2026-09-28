import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as AuditController from '../controllers/audit.controller';
import { auditQuerySchema, auditIdParamSchema } from '../validators/audit.validator';
import { ROLES } from '../constants';

const router = Router();
router.use(authenticate);

// Audit logs are read-only from the API — writes come only from the middleware.
// Restricted to ADMIN only to prevent log tampering visibility issues.

/**
 * GET /api/v1/audit
 * List audit log entries with filters.
 * Query: ?userId ?action ?entity ?entityId ?search ?fromDate ?toDate ?page ?pageSize ?sortOrder
 * Access: ADMIN only
 */
router.get(
  '/',
  authorize(ROLES.ADMIN),
  validateRequest({ query: auditQuerySchema }),
  asyncHandler(AuditController.getAuditLogs),
);

/**
 * GET /api/v1/audit/:id
 * Get a single audit log entry.
 * Access: ADMIN only
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN),
  validateRequest({ params: auditIdParamSchema }),
  asyncHandler(AuditController.getAuditLogById),
);

export default router;
