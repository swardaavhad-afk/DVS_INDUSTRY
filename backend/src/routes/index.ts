import { Router } from 'express';
import { API_PREFIX } from '../constants';
import authRouter      from './auth.routes';
import auditRouter     from './audit.routes';
import departmentRouter from './department.routes';
import employeeRouter  from './employee.routes';
import inventoryRouter from './inventory.routes';
import ordersRouter    from './orders.routes';
import productionRouter from './production.routes';
import reportsRouter   from './reports.routes';
import securityRouter  from './security.routes';
import workforceRouter from './workforce.routes';

const router = Router();

// ── Feature routers ───────────────────────────────────────────────────────────
router.use(`${API_PREFIX}/auth`,        authRouter);
router.use(`${API_PREFIX}/audit`,       auditRouter);
router.use(`${API_PREFIX}/departments`, departmentRouter);
router.use(`${API_PREFIX}/employees`,   employeeRouter);
router.use(`${API_PREFIX}/inventory`,   inventoryRouter);
router.use(`${API_PREFIX}/orders`,      ordersRouter);
router.use(`${API_PREFIX}/production`,  productionRouter);
router.use(`${API_PREFIX}/reports`,     reportsRouter);
router.use(`${API_PREFIX}/security`,    securityRouter);
router.use(`${API_PREFIX}/workforce`,   workforceRouter);

// ── Health check ──────────────────────────────────────────────────────────────
router.get(`${API_PREFIX}/health`, (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
