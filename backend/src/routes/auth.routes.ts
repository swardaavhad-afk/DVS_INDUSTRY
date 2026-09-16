import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { auditLog } from '../middleware/auditLog';
import * as AuthController from '../controllers/auth.controller';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  userIdParamSchema,
} from '../validators/auth.validator';
import { ROLES } from '../constants';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────

/** POST /api/v1/auth/login */
router.post(
  '/login',
  auditLog,
  validateRequest({ body: loginSchema }),
  asyncHandler(AuthController.login),
);

/** POST /api/v1/auth/refresh */
router.post('/refresh', asyncHandler(AuthController.refreshTokens));

/** POST /api/v1/auth/forgot-password */
router.post(
  '/forgot-password',
  validateRequest({ body: forgotPasswordSchema }),
  asyncHandler(AuthController.forgotPassword),
);

/** POST /api/v1/auth/reset-password */
router.post(
  '/reset-password',
  validateRequest({ body: resetPasswordSchema }),
  asyncHandler(AuthController.resetPassword),
);

// ── Authenticated routes ──────────────────────────────────────────────────────

/** POST /api/v1/auth/logout */
router.post('/logout', authenticate, asyncHandler(AuthController.logout));

/** GET /api/v1/auth/me */
router.get('/me', authenticate, asyncHandler(AuthController.getMe));

/** PATCH /api/v1/auth/me */
router.patch(
  '/me',
  authenticate,
  validateRequest({ body: updateProfileSchema }),
  asyncHandler(AuthController.updateProfile),
);

/** PATCH /api/v1/auth/change-password */
router.patch(
  '/change-password',
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  asyncHandler(AuthController.changePassword),
);

// ── Admin-only routes ─────────────────────────────────────────────────────────

/** POST /api/v1/auth/register  (Admin only) */
router.post(
  '/register',
  authenticate,
  authorize(ROLES.ADMIN),
  validateRequest({ body: registerSchema }),
  asyncHandler(AuthController.register),
);

/** PATCH /api/v1/auth/users/:id/deactivate  (Admin only) */
router.patch(
  '/users/:id/deactivate',
  authenticate,
  authorize(ROLES.ADMIN),
  validateRequest({ params: userIdParamSchema }),
  asyncHandler(AuthController.deactivateUser),
);

/** GET /api/v1/auth/roles  (Admin & Manager) */
router.get(
  '/roles',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(AuthController.getRoles),
);

export default router;
