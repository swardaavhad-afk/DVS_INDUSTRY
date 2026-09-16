import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prismaClient';
import type {
  ShiftDto, ShiftListResult, ShiftFilters,
  CreateShiftData, UpdateShiftData,
  AttendanceDto, AttendanceListResult, AttendanceFilters,
  CreateAttendanceData, UpdateAttendanceData,
  DailyAttendanceSummary, AttendanceTrendEntry,
  AttendanceStatus,
} from '../interfaces';

// ── Select shapes ─────────────────────────────────────────────────────────────

const shiftSelect = {
  id: true, name: true, startTime: true, endTime: true,
  isNightShift: true, description: true, createdAt: true, updatedAt: true,
  _count: { select: { employees: true } },
} as const;

const attendanceSelect = {
  id: true, employeeId: true, date: true,
  clockIn: true, clockOut: true, workingHours: true,
  status: true, remarks: true, createdAt: true, updatedAt: true,
  employee: {
    select: {
      id: true, employeeCode: true, firstName: true,
      lastName: true, designation: true,
      department: { select: { id: true, name: true } },
    },
  },
} as const;

// ── Converters ────────────────────────────────────────────────────────────────

type PrismaShift = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>;
type PrismaAttendance = Prisma.AttendanceGetPayload<{ select: typeof attendanceSelect }>;

function toShiftDto(r: PrismaShift): ShiftDto {
  return { ...r };
}

function toAttendanceDto(r: PrismaAttendance): AttendanceDto {
  return {
    id: r.id,
    employeeId: r.employeeId,
    date: r.date,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    workingHours: r.workingHours,
    status: r.status as AttendanceStatus,
    remarks: r.remarks,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    employee: {
      id: r.employee.id,
      employeeCode: r.employee.employeeCode,
      firstName: r.employee.firstName,
      lastName: r.employee.lastName,
      designation: r.employee.designation,
      department: r.employee.department ?? null,
    },
  };
}

/** Calculate working hours from clockIn to clockOut (decimal hours). */
function calcWorkingHours(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime();
  return parseFloat((ms / 3_600_000).toFixed(2));
}

// ─────────────────────────────────────────────────────────────────────────────

export class WorkforceRepository {

  // ══ SHIFTS ════════════════════════════════════════════════════════════════

  async createShift(data: CreateShiftData): Promise<ShiftDto> {
    const raw = await prisma.shift.create({
      data: {
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        isNightShift: data.isNightShift ?? false,
        description: data.description ?? null,
      },
      select: shiftSelect,
    });
    return toShiftDto(raw);
  }

  async updateShift(id: number, data: UpdateShiftData): Promise<ShiftDto> {
    const up: Prisma.ShiftUpdateInput = {};
    if (data.name !== undefined)        up.name        = data.name;
    if (data.startTime !== undefined)   up.startTime   = data.startTime;
    if (data.endTime !== undefined)     up.endTime     = data.endTime;
    if (data.isNightShift !== undefined) up.isNightShift = data.isNightShift;
    if (data.description !== undefined) up.description = data.description;
    const raw = await prisma.shift.update({ where: { id }, data: up, select: shiftSelect });
    return toShiftDto(raw);
  }

  async deleteShift(id: number): Promise<void> {
    await prisma.shift.delete({ where: { id } });
  }

  async findShiftById(id: number): Promise<ShiftDto | null> {
    const raw = await prisma.shift.findUnique({ where: { id }, select: shiftSelect });
    return raw ? toShiftDto(raw) : null;
  }

  async findShiftByName(name: string): Promise<ShiftDto | null> {
    const raw = await prisma.shift.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: shiftSelect,
    });
    return raw ? toShiftDto(raw) : null;
  }

  async findAllShifts(f: ShiftFilters): Promise<ShiftListResult> {
    const { search, sortBy = 'name', sortOrder = 'asc', page = 1, pageSize = 50 } = f;
    const where: Prisma.ShiftWhereInput = {};
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    const orderBy: Prisma.ShiftOrderByWithRelationInput = { [sortBy]: sortOrder };
    const [data, total] = await prisma.$transaction([
      prisma.shift.findMany({ where, select: shiftSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.shift.count({ where }),
    ]);
    return { data: data.map(toShiftDto), total };
  }

  // ══ ATTENDANCE ════════════════════════════════════════════════════════════

  async createAttendance(data: CreateAttendanceData): Promise<AttendanceDto> {
    // Normalise date to midnight UTC so the unique[employeeId, date] works correctly
    const date = this.normaliseDate(data.date);

    let workingHours: number | null = null;
    if (data.clockIn && data.clockOut) {
      workingHours = calcWorkingHours(data.clockIn, data.clockOut);
    }

    const raw = await prisma.attendance.create({
      data: {
        employeeId: data.employeeId,
        date,
        status: data.status,
        clockIn: data.clockIn ?? null,
        clockOut: data.clockOut ?? null,
        workingHours,
        remarks: data.remarks ?? null,
      },
      select: attendanceSelect,
    });
    return toAttendanceDto(raw);
  }

  /** Upsert — creates if absent, updates if already exists for the same day. */
  async upsertAttendance(data: CreateAttendanceData): Promise<AttendanceDto> {
    const date = this.normaliseDate(data.date);
    let workingHours: number | null = null;
    if (data.clockIn && data.clockOut) {
      workingHours = calcWorkingHours(data.clockIn, data.clockOut);
    }

    const raw = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: data.employeeId, date } },
      create: {
        employeeId: data.employeeId,
        date,
        status: data.status,
        clockIn: data.clockIn ?? null,
        clockOut: data.clockOut ?? null,
        workingHours,
        remarks: data.remarks ?? null,
      },
      update: {
        status: data.status,
        clockIn: data.clockIn ?? null,
        clockOut: data.clockOut ?? null,
        workingHours,
        remarks: data.remarks ?? null,
      },
      select: attendanceSelect,
    });
    return toAttendanceDto(raw);
  }

  async updateAttendance(id: number, data: UpdateAttendanceData): Promise<AttendanceDto> {
    // Re-fetch to compute working hours if needed
    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) throw new Error('Attendance record not found');

    const newClockIn  = data.clockIn  !== undefined ? data.clockIn  : existing.clockIn;
    const newClockOut = data.clockOut !== undefined ? data.clockOut : existing.clockOut;
    let workingHours: number | null = existing.workingHours;
    if (newClockIn && newClockOut) {
      workingHours = calcWorkingHours(newClockIn, newClockOut);
    }

    const up: Prisma.AttendanceUpdateInput = { workingHours };
    if (data.status !== undefined)   up.status   = data.status;
    if (data.clockIn !== undefined)  up.clockIn  = data.clockIn;
    if (data.clockOut !== undefined) up.clockOut = data.clockOut;
    if (data.remarks !== undefined)  up.remarks  = data.remarks;

    const raw = await prisma.attendance.update({ where: { id }, data: up, select: attendanceSelect });
    return toAttendanceDto(raw);
  }

  async findAttendanceById(id: number): Promise<AttendanceDto | null> {
    const raw = await prisma.attendance.findUnique({ where: { id }, select: attendanceSelect });
    return raw ? toAttendanceDto(raw) : null;
  }

  async findAttendanceByEmployeeAndDate(
    employeeId: number,
    date: Date,
  ): Promise<AttendanceDto | null> {
    const raw = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: this.normaliseDate(date) } },
      select: attendanceSelect,
    });
    return raw ? toAttendanceDto(raw) : null;
  }

  async findAllAttendance(f: AttendanceFilters): Promise<AttendanceListResult> {
    const {
      employeeId, departmentId, status = 'all',
      date, fromDate, toDate,
      sortOrder = 'desc', page = 1, pageSize = 20,
    } = f;

    const where: Prisma.AttendanceWhereInput = {};

    if (employeeId !== undefined) where.employeeId = employeeId;

    if (status !== 'all') where.status = status as AttendanceStatus;

    if (date !== undefined) {
      where.date = this.normaliseDate(date);
    } else if (fromDate !== undefined || toDate !== undefined) {
      where.date = {};
      if (fromDate) where.date.gte = this.normaliseDate(fromDate);
      if (toDate)   where.date.lte = this.normaliseDate(toDate);
    }

    if (departmentId !== undefined) {
      where.employee = { departmentId };
    }

    const [raws, total] = await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        select: attendanceSelect,
        orderBy: { date: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.attendance.count({ where }),
    ]);
    return { data: raws.map(toAttendanceDto), total };
  }

  async deleteAttendance(id: number): Promise<void> {
    await prisma.attendance.delete({ where: { id } });
  }

  // ── Bulk upsert ─────────────────────────────────────────────────────────────

  async bulkUpsert(
    date: Date,
    entries: Array<{
      employeeId: number;
      status: AttendanceStatus;
      clockIn?: Date | null;
      clockOut?: Date | null;
      remarks?: string | null;
    }>,
  ): Promise<{ created: number; updated: number }> {
    const normDate = this.normaliseDate(date);
    let created = 0;
    let updated = 0;

    // Use a transaction for atomicity
    await prisma.$transaction(
      entries.map((e) => {
        let wh: number | null = null;
        if (e.clockIn && e.clockOut) wh = calcWorkingHours(e.clockIn, e.clockOut);

        return prisma.attendance.upsert({
          where: { employeeId_date: { employeeId: e.employeeId, date: normDate } },
          create: {
            employeeId: e.employeeId, date: normDate,
            status: e.status, clockIn: e.clockIn ?? null,
            clockOut: e.clockOut ?? null, workingHours: wh,
            remarks: e.remarks ?? null,
          },
          update: {
            status: e.status, clockIn: e.clockIn ?? null,
            clockOut: e.clockOut ?? null, workingHours: wh,
            remarks: e.remarks ?? null,
          },
          select: { id: true },
        });
      }),
    );

    // Approximate counts (upsert doesn't distinguish create/update easily)
    created = entries.length;
    updated = 0;
    return { created, updated };
  }

  // ── Clock-in (upserts today's record with PRESENT status) ────────────────────

  async clockIn(employeeId: number, clockIn: Date, remarks?: string | null): Promise<AttendanceDto> {
    const date = this.normaliseDate(clockIn);
    const raw = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        employeeId, date,
        clockIn,
        status: 'PRESENT',
        remarks: remarks ?? null,
      },
      update: {
        clockIn,
        status: 'PRESENT',
        ...(remarks !== undefined && { remarks }),
      },
      select: attendanceSelect,
    });
    return toAttendanceDto(raw);
  }

  // ── Clock-out (updates clockOut + calculates workingHours) ────────────────────

  async clockOut(id: number, clockOut: Date, remarks?: string | null): Promise<AttendanceDto> {
    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) throw new Error('Attendance record not found');

    let workingHours: number | null = null;
    if (existing.clockIn) {
      workingHours = calcWorkingHours(existing.clockIn, clockOut);
    }

    const raw = await prisma.attendance.update({
      where: { id },
      data: {
        clockOut,
        workingHours,
        ...(remarks !== undefined && { remarks }),
      },
      select: attendanceSelect,
    });
    return toAttendanceDto(raw);
  }

  // ══ SUMMARY & TREND ═══════════════════════════════════════════════════════

  async getDailySummary(
    date: Date,
    departmentId?: number,
  ): Promise<DailyAttendanceSummary> {
    const normDate = this.normaliseDate(date);
    const empWhere: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      ...(departmentId ? { departmentId } : {}),
    };

    const [totalEmployees, records, depts] = await prisma.$transaction([
      prisma.employee.count({ where: empWhere }),
      prisma.attendance.findMany({
        where: {
          date: normDate,
          ...(departmentId ? { employee: { departmentId } } : {}),
        },
        select: { status: true, employee: { select: { departmentId: true } } },
      }),
      prisma.department.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    const counts = { present: 0, absent: 0, halfDay: 0, late: 0, onLeave: 0 };
    const deptPresentMap = new Map<number, number>();

    for (const r of records) {
      if (r.status === 'PRESENT') { counts.present++; }
      else if (r.status === 'ABSENT')  { counts.absent++; }
      else if (r.status === 'HALF_DAY') { counts.halfDay++; }
      else if (r.status === 'LATE')    { counts.late++; }
      else if (r.status === 'LEAVE')   { counts.onLeave++; }

      if (r.status === 'PRESENT' && r.employee.departmentId !== null) {
        deptPresentMap.set(
          r.employee.departmentId,
          (deptPresentMap.get(r.employee.departmentId) ?? 0) + 1,
        );
      }
    }

    // Dept-level totals
    const deptEmpCounts = await prisma.employee.groupBy({
      by: ['departmentId'],
      where: { ...empWhere, departmentId: { not: null } },
      _count: { id: true },
    });
    const deptTotalMap = new Map(
      deptEmpCounts
        .filter(r => r.departmentId !== null)
        .map(r => [r.departmentId as number, r._count.id]),
    );
    const deptNameMap = new Map(depts.map(d => [d.id, d.name]));

    const byDepartment = Array.from(deptTotalMap.entries()).map(([id, total]) => ({
      departmentId: id,
      departmentName: deptNameMap.get(id) ?? 'Unknown',
      present: deptPresentMap.get(id) ?? 0,
      total,
    }));

    const attended = counts.present + counts.late + counts.halfDay;
    const attendanceRate = totalEmployees > 0
      ? ((attended / totalEmployees) * 100).toFixed(1) + '%'
      : '0.0%';

    return {
      date: normDate.toISOString().split('T')[0]!,
      totalEmployees,
      present: counts.present,
      absent: counts.absent,
      halfDay: counts.halfDay,
      late: counts.late,
      onLeave: counts.onLeave,
      attendanceRate,
      byDepartment,
    };
  }

  async getAttendanceTrend(
    days: number,
    departmentId?: number,
  ): Promise<AttendanceTrendEntry[]> {
    const trend: AttendanceTrendEntry[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const normDate = this.normaliseDate(d);

      const records = await prisma.attendance.findMany({
        where: {
          date: normDate,
          ...(departmentId ? { employee: { departmentId } } : {}),
        },
        select: { status: true },
      });

      const present = records.filter(r => r.status === 'PRESENT').length;
      const absent  = records.filter(r => r.status === 'ABSENT').length;
      const late    = records.filter(r => r.status === 'LATE').length;

      trend.push({
        date: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        present,
        absent,
        late,
      });
    }

    return trend;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private normaliseDate(d: Date): Date {
    const n = new Date(d);
    n.setUTCHours(0, 0, 0, 0);
    return n;
  }
}
