-- ── Production Module Migration ───────────────────────────────────────────────
-- Creates: WorkOrderStatus enum, WorkOrderPriority enum,
--          WorkOrder table, WorkOrderOutput table

-- Enums
CREATE TYPE "WorkOrderStatus" AS ENUM (
  'DRAFT',
  'RELEASED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "WorkOrderPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

-- WorkOrder
CREATE TABLE "WorkOrder" (
    "id"              SERIAL NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "product"         TEXT NOT NULL,
    "targetQuantity"  DECIMAL(12,3) NOT NULL,
    "unit"            TEXT NOT NULL DEFAULT 'pcs',
    "scheduledStart"  TIMESTAMP(3),
    "scheduledEnd"    TIMESTAMP(3),
    "actualStart"     TIMESTAMP(3),
    "actualEnd"       TIMESTAMP(3),
    "status"          "WorkOrderStatus"   NOT NULL DEFAULT 'DRAFT',
    "priority"        "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "departmentId"    INTEGER,
    "departmentName"  TEXT,
    "assignedToId"    INTEGER,
    "assignedToName"  TEXT,
    "clientOrderId"   INTEGER,
    "notes"           TEXT,
    "createdById"     INTEGER,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"       TIMESTAMP(3),

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkOrder_workOrderNumber_key" ON "WorkOrder"("workOrderNumber");
CREATE INDEX "WorkOrder_status_idx"        ON "WorkOrder"("status");
CREATE INDEX "WorkOrder_priority_idx"      ON "WorkOrder"("priority");
CREATE INDEX "WorkOrder_departmentId_idx"  ON "WorkOrder"("departmentId");
CREATE INDEX "WorkOrder_scheduledStart_idx" ON "WorkOrder"("scheduledStart");
CREATE INDEX "WorkOrder_clientOrderId_idx" ON "WorkOrder"("clientOrderId");

-- WorkOrderOutput
CREATE TABLE "WorkOrderOutput" (
    "id"             SERIAL NOT NULL,
    "workOrderId"    INTEGER NOT NULL,
    "goodQty"        DECIMAL(12,3) NOT NULL,
    "rejectedQty"    DECIMAL(12,3) NOT NULL DEFAULT 0,
    "scrapQty"       DECIMAL(12,3) NOT NULL DEFAULT 0,
    "recordedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById"   INTEGER,
    "recordedByName" TEXT,
    "remarks"        TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderOutput_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkOrderOutput_workOrderId_idx" ON "WorkOrderOutput"("workOrderId");
CREATE INDEX "WorkOrderOutput_recordedAt_idx"  ON "WorkOrderOutput"("recordedAt");

ALTER TABLE "WorkOrderOutput"
    ADD CONSTRAINT "WorkOrderOutput_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
