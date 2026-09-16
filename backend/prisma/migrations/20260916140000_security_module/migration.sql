-- ── Security Module Migration ─────────────────────────────────────────────────
-- Creates: IncidentType, IncidentSeverity, IncidentStatus, AlertType, AlertStatus enums
--          SecurityIncident, IncidentUpdate, SecurityAlert tables

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "IncidentType" AS ENUM (
  'FIRE',
  'THEFT',
  'INJURY',
  'PROPERTY_DAMAGE',
  'UNAUTHORIZED_ACCESS',
  'EQUIPMENT_FAILURE',
  'CHEMICAL_SPILL',
  'NEAR_MISS',
  'OTHER'
);

CREATE TYPE "IncidentSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "IncidentStatus" AS ENUM (
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE "AlertType" AS ENUM (
  'SAFETY',
  'SECURITY',
  'MAINTENANCE',
  'FIRE',
  'INTRUSION',
  'ENVIRONMENTAL',
  'CUSTOM'
);

CREATE TYPE "AlertStatus" AS ENUM (
  'ACTIVE',
  'ACKNOWLEDGED',
  'RESOLVED',
  'EXPIRED'
);

-- ── SecurityIncident ──────────────────────────────────────────────────────────

CREATE TABLE "SecurityIncident" (
    "id"               SERIAL          NOT NULL,
    "incidentNumber"   TEXT            NOT NULL,
    "title"            TEXT            NOT NULL,
    "description"      TEXT            NOT NULL,
    "type"             "IncidentType"  NOT NULL,
    "severity"         "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status"           "IncidentStatus"  NOT NULL DEFAULT 'OPEN',
    "location"         TEXT,
    "departmentId"     INTEGER,
    "departmentName"   TEXT,
    "reportedById"     INTEGER,
    "reportedByName"   TEXT,
    "assignedToId"     INTEGER,
    "assignedToName"   TEXT,
    "occurredAt"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"       TIMESTAMP(3),
    "closedAt"         TIMESTAMP(3),
    "rootCause"        TEXT,
    "correctiveAction" TEXT,
    "createdAt"        TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"        TIMESTAMP(3),

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecurityIncident_incidentNumber_key" ON "SecurityIncident"("incidentNumber");
CREATE INDEX "SecurityIncident_type_idx"         ON "SecurityIncident"("type");
CREATE INDEX "SecurityIncident_severity_idx"     ON "SecurityIncident"("severity");
CREATE INDEX "SecurityIncident_status_idx"       ON "SecurityIncident"("status");
CREATE INDEX "SecurityIncident_departmentId_idx" ON "SecurityIncident"("departmentId");
CREATE INDEX "SecurityIncident_occurredAt_idx"   ON "SecurityIncident"("occurredAt");

-- ── IncidentUpdate ────────────────────────────────────────────────────────────

CREATE TABLE "IncidentUpdate" (
    "id"             SERIAL          NOT NULL,
    "incidentId"     INTEGER         NOT NULL,
    "comment"        TEXT            NOT NULL,
    "statusChange"   "IncidentStatus",
    "updatedById"    INTEGER,
    "updatedByName"  TEXT,
    "createdAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IncidentUpdate_incidentId_idx" ON "IncidentUpdate"("incidentId");
CREATE INDEX "IncidentUpdate_createdAt_idx"  ON "IncidentUpdate"("createdAt");

ALTER TABLE "IncidentUpdate"
    ADD CONSTRAINT "IncidentUpdate_incidentId_fkey"
    FOREIGN KEY ("incidentId") REFERENCES "SecurityIncident"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── SecurityAlert ─────────────────────────────────────────────────────────────

CREATE TABLE "SecurityAlert" (
    "id"                  SERIAL           NOT NULL,
    "alertNumber"         TEXT             NOT NULL,
    "title"               TEXT             NOT NULL,
    "message"             TEXT             NOT NULL,
    "type"                "AlertType"      NOT NULL,
    "severity"            "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status"              "AlertStatus"    NOT NULL DEFAULT 'ACTIVE',
    "source"              TEXT,
    "location"            TEXT,
    "departmentId"        INTEGER,
    "departmentName"      TEXT,
    "incidentId"          INTEGER,
    "acknowledgedById"    INTEGER,
    "acknowledgedByName"  TEXT,
    "acknowledgedAt"      TIMESTAMP(3),
    "resolvedById"        INTEGER,
    "resolvedByName"      TEXT,
    "resolvedAt"          TIMESTAMP(3),
    "expiresAt"           TIMESTAMP(3),
    "createdById"         INTEGER,
    "createdAt"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecurityAlert_alertNumber_key"   ON "SecurityAlert"("alertNumber");
CREATE INDEX "SecurityAlert_type_idx"         ON "SecurityAlert"("type");
CREATE INDEX "SecurityAlert_severity_idx"     ON "SecurityAlert"("severity");
CREATE INDEX "SecurityAlert_status_idx"       ON "SecurityAlert"("status");
CREATE INDEX "SecurityAlert_departmentId_idx" ON "SecurityAlert"("departmentId");
CREATE INDEX "SecurityAlert_incidentId_idx"   ON "SecurityAlert"("incidentId");
CREATE INDEX "SecurityAlert_createdAt_idx"    ON "SecurityAlert"("createdAt");

ALTER TABLE "SecurityAlert"
    ADD CONSTRAINT "SecurityAlert_incidentId_fkey"
    FOREIGN KEY ("incidentId") REFERENCES "SecurityIncident"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
