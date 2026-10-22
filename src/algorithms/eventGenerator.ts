import {
  AcademicCalendar,
  Classroom,
  ClassSessionEvent,
  InputValidationError,
  StudentSection,
  SubjectRequirement,
  Teacher,
  TimeSlot,
} from '../types/timetable';

/**
 * Stage 1: Validate all academic inputs before graph construction and coloring.
 */
export function validateAcademicInputs(
  calendar: AcademicCalendar,
  sections: StudentSection[],
  teachers: Teacher[],
  subjects: SubjectRequirement[],
  classrooms: Classroom[]
): InputValidationError[] {
  const errors: InputValidationError[] = [];

  if (calendar.workingDays.length === 0) {
    errors.push({
      id: 'ERR-CAL-DAYS',
      entityType: 'CALENDAR',
      entityName: 'Working Days',
      message: 'At least one working day must be enabled in the Academic Calendar.',
      isBlocking: true,
    });
  }

  const teachingPeriods = calendar.periods.filter((p) => !p.isBreak);
  if (teachingPeriods.length === 0) {
    errors.push({
      id: 'ERR-CAL-PERIODS',
      entityType: 'CALENDAR',
      entityName: 'Teaching Periods',
      message: 'The academic calendar has zero non-break teaching periods.',
      isBlocking: true,
    });
  }

  if (sections.length === 0) {
    errors.push({
      id: 'ERR-SEC-EMPTY',
      entityType: 'SECTION',
      entityName: 'Student Sections',
      message: 'No student sections are defined. Add at least one student section.',
      isBlocking: true,
    });
  }

  if (teachers.length === 0) {
    errors.push({
      id: 'ERR-TCH-EMPTY',
      entityType: 'TEACHER',
      entityName: 'Teachers',
      message: 'No teachers are defined. Add at least one faculty member.',
      isBlocking: true,
    });
  }

  if (subjects.length === 0) {
    errors.push({
      id: 'ERR-SUB-EMPTY',
      entityType: 'SUBJECT',
      entityName: 'Subjects',
      message: 'No subject requirements are defined. Add at least one subject to schedule.',
      isBlocking: true,
    });
  }

  if (classrooms.length === 0) {
    errors.push({
      id: 'ERR-RM-EMPTY',
      entityType: 'ROOM',
      entityName: 'Classrooms & Labs',
      message: 'No classrooms or laboratories are defined. Add at least one room.',
      isBlocking: true,
    });
  }

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  for (const sub of subjects) {
    if (!teacherMap.has(sub.teacherId)) {
      errors.push({
        id: `ERR-SUB-TCH-${sub.id}`,
        entityType: 'SUBJECT',
        entityName: `${sub.code} (${sub.name})`,
        message: `Assigned teacher ID "${sub.teacherId}" does not exist.`,
        isBlocking: true,
      });
    }

    if (!sub.sectionIds || sub.sectionIds.length === 0) {
      errors.push({
        id: `ERR-SUB-SEC-${sub.id}`,
        entityType: 'SUBJECT',
        entityName: `${sub.code} (${sub.name})`,
        message: 'Subject is not assigned to any student section.',
        isBlocking: true,
      });
    } else {
      for (const secId of sub.sectionIds) {
        if (!sectionMap.has(secId)) {
          errors.push({
            id: `ERR-SUB-SECMISS-${sub.id}-${secId}`,
            entityType: 'SUBJECT',
            entityName: `${sub.code} (${sub.name})`,
            message: `Assigned section ID "${secId}" does not exist.`,
            isBlocking: true,
          });
        }
      }
    }

    if (sub.sessionDuration < 1 || sub.sessionDuration > teachingPeriods.length) {
      errors.push({
        id: `ERR-SUB-DUR-${sub.id}`,
        entityType: 'SUBJECT',
        entityName: `${sub.code} (${sub.name})`,
        message: `Session duration (${sub.sessionDuration} periods) is invalid for the current daily schedule.`,
        isBlocking: true,
      });
    }

    // Check if at least one room matches type and capacity
    const compatibleRooms = classrooms.filter(
      (r) => r.roomType === sub.requiredRoomType && r.capacity >= sub.expectedEnrollment
    );
    if (compatibleRooms.length === 0) {
      errors.push({
        id: `ERR-SUB-ROOM-${sub.id}`,
        entityType: 'SUBJECT',
        entityName: `${sub.code} (${sub.name})`,
        message: `No ${sub.requiredRoomType} has capacity >= ${sub.expectedEnrollment} students. Event will remain unscheduled unless a compatible room is added.`,
        isBlocking: false, // Warning before run; engine will record unscheduled reason
      });
    }
  }

  return errors;
}

/**
 * Stage 2: Expand each subject's weekly requirements into individual class-session event vertices.
 * For example, 3 weekly Mathematics lectures for CSE-A become 3 distinct vertices in the conflict graph.
 */
export function expandSubjectRequirementsToEvents(
  subjects: SubjectRequirement[],
  teachers: Teacher[],
  sections: StudentSection[]
): ClassSessionEvent[] {
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const events: ClassSessionEvent[] = [];

  for (const sub of subjects) {
    const teacher = teacherMap.get(sub.teacherId);
    const participatingSections = sub.sectionIds
      .map((id) => sectionMap.get(id))
      .filter((s): s is StudentSection => Boolean(s));

    const sectionLabel = participatingSections.map((s) => s.name).join('+');
    const calculatedEnrollment =
      sub.expectedEnrollment > 0
        ? sub.expectedEnrollment
        : participatingSections.reduce((sum, s) => sum + s.studentStrength, 0);

    for (let i = 1; i <= sub.sessionsPerWeek; i++) {
      const eventId = `E-${sub.code}-${sectionLabel}-${i}`;
      events.push({
        eventId,
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        sessionIndex: i,
        totalSessionsForSubject: sub.sessionsPerWeek,
        teacherId: sub.teacherId,
        teacherName: teacher ? teacher.name : 'Unassigned Teacher',
        sectionIds: [...sub.sectionIds],
        sectionNames: participatingSections.map((s) => s.name),
        duration: sub.sessionDuration,
        requiredRoomType: sub.requiredRoomType,
        sessionType: sub.sessionType,
        enrollment: calculatedEnrollment,
        preferredDays: [...sub.preferredDays],
        preferredSlots: [...sub.preferredSlots],
        maxSessionsPerDay: sub.maxSessionsPerDay,
        colorHex: sub.colorHex || '#4f46e5',
      });
    }
  }

  return events;
}

/**
 * Stage 4: Generate all candidate teaching time-slot colors from the AcademicCalendar.
 * Excludes break/lunch periods and institutionally disabled slots.
 */
export function generateAvailableTimeSlots(calendar: AcademicCalendar): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const unavailableSet = new Set(calendar.unavailableSlots);
  let colorIndex = 1;

  for (const day of calendar.workingDays) {
    for (const period of calendar.periods) {
      if (period.isBreak) continue;
      const slotKey = `${day}-P${period.periodNumber}`;
      if (unavailableSet.has(slotKey)) continue;

      slots.push({
        slotKey,
        colorIndex: colorIndex++,
        day,
        periodNumber: period.periodNumber,
        periodName: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
      });
    }
  }

  return slots;
}

/**
 * Given a candidate starting TimeSlot and a required duration (in periods),
 * verifies that `duration` consecutive periods exist on the same day without crossing
 * any break period or institutionally unavailable slot.
 * Returns the array of consecutive TimeSlots if valid, or null otherwise.
 */
export function getConsecutiveSlotsForDuration(
  startSlot: TimeSlot,
  duration: number,
  calendar: AcademicCalendar,
  allTimeSlots: TimeSlot[]
): TimeSlot[] | null {
  if (duration === 1) {
    return [startSlot];
  }

  const slotMap = new Map(allTimeSlots.map((s) => [s.slotKey, s]));
  const dayPeriods = [...calendar.periods].sort((a, b) => a.periodNumber - b.periodNumber);
  const startIdx = dayPeriods.findIndex((p) => p.periodNumber === startSlot.periodNumber);

  if (startIdx === -1 || startIdx + duration > dayPeriods.length) {
    return null;
  }

  const result: TimeSlot[] = [];
  for (let offset = 0; offset < duration; offset++) {
    const periodDef = dayPeriods[startIdx + offset];
    // Must not be a break period!
    if (periodDef.isBreak) {
      return null;
    }
    const key = `${startSlot.day}-P${periodDef.periodNumber}`;
    const targetSlot = slotMap.get(key);
    if (!targetSlot) {
      // Institutionally unavailable
      return null;
    }
    result.push(targetSlot);
  }

  return result;
}
