-- Department Module Migration
-- Replaces the stub Department model with the full production model.
-- Employee.departmentId becomes nullable to support soft-deleted departments.

-- ── 1. Drop old constraint and foreign key on Employee ──────────────────────
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_departmentId_fkey";
DROP INDEX IF EXISTS "Employee_departmentId_idx";

-- ── 2. Alter Employee.departmentId to nullable ───────────────────────────────
ALTER TABLE "Employee" ALTER COLUMN "departmentId" DROP NOT NULL;

-- ── 3. Upgrade Department table ──────────────────────────────────────────────
ALTER TABLE "Department"
  ADD COLUMN "code"        TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "managerId"   INTEGER,
  ADD COLUMN "isActive"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt"   TIMESTAMP(3),
  ADD COLUMN "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Back-fill code from name (upper-snake-case) for any existing rows
UPDATE "Department"
SET "code" = UPPER(REPLACE(REPLACE(TRIM("name"), ' ', '_'), '-', '_'))
WHERE "code" IS NULL;

-- Now make code NOT NULL and UNIQUE
ALTER TABLE "Department" ALTER COLUMN "code" SET NOT NULL;

-- ── 4. Add unique indexes ─────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "Department_code_key" ON "Department"("code");
CREATE INDEX IF NOT EXISTS "Department_code_idx"    ON "Department"("code");
CREATE INDEX IF NOT EXISTS "Department_isActive_idx" ON "Department"("isActive");
CREATE INDEX IF NOT EXISTS "Department_deletedAt_idx" ON "Department"("deletedAt");

-- ── 5. Re-add Employee foreign key (nullable) ─────────────────────────────────
CREATE INDEX IF NOT EXISTS "Employee_departmentId_idx" ON "Employee"("departmentId");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_departmentId_fkey"
  FOREIGN KEY ("departmentId")
  REFERENCES "Department"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
