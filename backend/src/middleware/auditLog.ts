import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types';
import { AuditRepository } from '../repositories/audit.repository';
import type { AuditAction, CreateAuditLogData } from '../interfaces';

const repo = new AuditRepository();

/**
 * Maps HTTP method + response status → AuditAction.
 * Only write operations (POST/PATCH/PUT/DELETE) and special endpoints are logged.
 */
function resolveAction(method: string, path: string, statusCode: number): AuditAction | null {
  if (statusCode >= 400) return null; // don't log failed requests

  const m = method.toUpperCase();
  if (path.includes('/login')) return 'LOGIN';
  if (path.includes('/logout')) return 'LOGOUT';
  if (path.includes('/export') || path.includes('/reports')) return 'EXPORT';
  if (
    path.includes('/status') ||
    path.includes('/approve') ||
    path.includes('/dispatch') ||
    path.includes('/deliver') ||
    path.includes('/cancel') ||
    path.includes('/confirm') ||
    path.includes('/transit') ||
    path.includes('/production')
  ) {
    return 'STATUS_CHANGE';
  }
  if (path.includes('/bulk')) return 'BULK_ACTION';

  if (m === 'POST') return 'CREATE';
  if (m === 'PATCH' || m === 'PUT') return 'UPDATE';
  if (m === 'DELETE') return 'DELETE';
  return null; // GET — skip
}

/**
 * Extracts the entity name from the URL path.
 * e.g. /api/v1/employees/5  → "Employee"
 *      /api/v1/work-orders/3/outputs/2 → "WorkOrderOutput"
 */
function resolveEntity(path: string): string {
  const segments = path.split('/').filter(Boolean);
  // Find the segment after the version prefix (api, v1)
  const versionIdx = segments.findIndex((s) => /^v\d+$/.test(s));
  const entitySeg = segments[versionIdx + 1] ?? segments[2] ?? 'Unknown';

  const map: Record<string, string> = {
    auth: 'Auth',
    employees: 'Employee',
    departments: 'Department',
    inventory: 'Inventory',
    workforce: 'Workforce',
    production: 'Production',
    'work-orders': 'WorkOrder',
    orders: 'Order',
    suppliers: 'Supplier',
    clients: 'Client',
    'client-orders': 'ClientOrder',
    'purchase-orders': 'PurchaseOrder',
    reports: 'Report',
    audit: 'AuditLog',
  };
  return map[entitySeg] ?? entitySeg;
}

/** Extract the last numeric segment as entityId. */
function resolveEntityId(path: string): string | null {
  const segs = path.split('/').filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(segs[i] ?? '')) return segs[i] ?? null;
  }
  return null;
}

/**
 * auditLog middleware
 *
 * Attach AFTER authenticate so req.user is available.
 * Intercepts res.end() to capture the final status code.
 *
 * Usage:
 *   router.use(authenticate, auditLog, ...handlers)
 *   — or selectively:
 *   router.post('/items', authenticate, auditLog, handler)
 */
export function auditLog(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const originalEnd = res.end.bind(res);

  // Override res.end to hook into response completion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).end = function (...args: Parameters<typeof res.end>) {
    const statusCode = res.statusCode;
    const action = resolveAction(req.method, req.path, statusCode);

    if (action !== null) {
      const data: CreateAuditLogData = {
        userId: req.user?.id ?? null,
        userEmail: req.user?.email ?? null,
        userRole: req.user?.role ?? null,
        action,
        entity: resolveEntity(req.path),
        entityId: resolveEntityId(req.path),
        method: req.method,
        path: req.originalUrl,
        statusCode,
        ipAddress:
          (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
          req.socket.remoteAddress ??
          null,
        userAgent: req.headers['user-agent'] ?? null,
      };

      // Fire and forget — never awaited, never throws
      void repo.log(data);
    }

    return originalEnd(...args);
  };

  next();
}
