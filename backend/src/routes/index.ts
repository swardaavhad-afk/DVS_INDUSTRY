import { Router } from 'express';
import { API_PREFIX } from '../constants';
import authRouter from './auth.routes';
import departmentRouter from './department.routes';
import employeeRouter from './employee.routes';
import inventoryRouter from './inventory.routes';
import ordersRouter from './orders.routes';

const router = Router();

// ── Feature routers ───────────────────────────────────────────────────────────
router.use(`${API_PREFIX}/auth`, authRouter);
router.use(`${API_PREFIX}/departments`, departmentRouter);
router.use(`${API_PREFIX}/employees`, employeeRouter);
router.use(`${API_PREFIX}/inventory`, inventoryRouter);
router.use(`${API_PREFIX}/orders`, ordersRouter);

// ── Health check ──────────────────────────────────────────────────────────────
router.get(`${API_PREFIX}/health`, (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
