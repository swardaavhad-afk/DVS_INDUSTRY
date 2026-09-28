-- ── Audit Log Migration ────────────────────────────────────────────────────────
-- Creates: AuditAction enum, AuditLog table

CREATE TYPE "AuditAction" AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'EXPORT',
  'STATUS_CHANGE',
  'BULK_ACTION'
);

CREATE TABLE "AuditLog" (
    "id"         SERIAL NOT NULL,
    "userId"     INTEGER,
    "userEmail"  TEXT,
    "userRole"   TEXT,
    "action"     "AuditAction" NOT NULL,
    "entity"     TEXT NOT NULL,
    "entityId"   TEXT,
    "entityCode" TEXT,
    "method"     TEXT,
    "path"       TEXT,
    "statusCode" INTEGER,
    "before"     JSONB,
    "after"      JSONB,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_idx"    ON "AuditLog"("userId");
CREATE INDEX "AuditLog_entity_idx"    ON "AuditLog"("entity");
CREATE INDEX "AuditLog_action_idx"    ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
