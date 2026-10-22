import {
  AcademicCalendar,
  Classroom,
  ClassSessionEvent,
  ScheduledSession,
  SoftConstraintWeights,
  StudentSection,
  Teacher,
  UnscheduledSession,
  ValidationIssue,
  ValidationSummary,
} from '../types/timetable';
import { evaluateScheduleSoftConstraints } from './softConstraints';

/**
 * Stage 8: Independent Timetable Validator.
 * Verifies every hard constraint from scratch without trusting the scheduler's internal state.
 * A schedule is marked `isFullyValid = true` ONLY when every required event is scheduled
 * AND there are zero hard constraint violations.
 */
export function runIndependentTimetableValidator(
  requiredEvents: ClassSessionEvent[],
  scheduledSessions: ScheduledSession[],
  unscheduledSessions: UnscheduledSession[],
  calendar: AcademicCalendar,
  sections: StudentSection[],
  teachers: Teacher[],
  classrooms: Classroom[],
  softWeights: SoftConstraintWeights
): ValidationSummary {
  const hardIssues: ValidationIssue[] = [];

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r]));
  const periodMap = new Map(calendar.periods.map((p) => [p.periodNumber, p]));
  const calUnavailable = new Set(calendar.unavailableSlots);

  // 1. Check for duplicate assignments of the same eventId
  const seenEventIds = new Map<string, ScheduledSession[]>();
  for (const sess of scheduledSessions) {
    const arr = seenEventIds.get(sess.eventId) || [];
    arr.push(sess);
    seenEventIds.set(sess.eventId, arr);
  }
  for (const [eventId, list] of seenEventIds.entries()) {
    if (list.length > 1) {
      hardIssues.push({
        id: `HARD-DUP-${eventId}`,
        severity: 'HARD',
        category: 'DUPLICATE_ASSIGNMENT',
        title: 'Duplicate Event Assignment',
        affectedEventIds: [eventId],
        dayAndTime: list.map((s) => s.startSlotKey).join(', '),
        affectedEntities: list[0].event.subjectCode,
        explanation: `Event ${eventId} is scheduled ${list.length} times in the timetable.`,
        suggestedCorrection: `Remove the duplicate entry for ${eventId}.`,
      });
    }
  }

  // 2. Check for missing required sessions
  for (const reqEvt of requiredEvents) {
    if (!seenEventIds.has(reqEvt.eventId)) {
      const unschedRecord = unscheduledSessions.find((u) => u.eventId === reqEvt.eventId);
      hardIssues.push({
        id: `HARD-MISSING-${reqEvt.eventId}`,
        severity: 'HARD',
        category: 'MISSING_REQUIRED_SESSION',
        title: 'Unscheduled Required Class Session',
        affectedEventIds: [reqEvt.eventId],
        dayAndTime: 'Unassigned',
        affectedEntities: `${reqEvt.subjectCode} (${reqEvt.sectionNames.join(', ')}) · ${reqEvt.teacherName}`,
        explanation:
          unschedRecord?.reason ||
          `Required weekly session ${reqEvt.eventId} (${reqEvt.subjectName}) was not assigned a valid time slot and room.`,
        suggestedCorrection:
          'Expand teacher or section availability, add a compatible room, or run DSATUR/Backtracking with relaxed constraints.',
      });
    }
  }

  // 3. Individual session hard constraint checks
  for (const sess of scheduledSessions) {
    const evt = sess.event;
    const teacher = teacherMap.get(evt.teacherId);
    const room = roomMap.get(sess.roomId);

    // 3a. Room capacity check
    if (!room) {
      hardIssues.push({
        id: `HARD-NOROOM-${sess.eventId}`,
        severity: 'HARD',
        category: 'ROOM_TYPE_MISMATCH',
        title: 'Invalid Classroom Reference',
        affectedEventIds: [sess.eventId],
        dayAndTime: sess.occupiedSlotKeys.join(', '),
        affectedEntities: sess.roomName || sess.roomId,
        explanation: `Assigned room "${sess.roomId}" does not exist in the classroom inventory.`,
        suggestedCorrection: 'Reassign the event to an existing valid classroom.',
      });
    } else {
      if (room.capacity < evt.enrollment) {
        hardIssues.push({
          id: `HARD-CAP-${sess.eventId}`,
          severity: 'HARD',
          category: 'ROOM_CAPACITY',
          title: 'Room Capacity Violation',
          affectedEventIds: [sess.eventId],
          dayAndTime: sess.occupiedSlotKeys.join(', '),
          affectedEntities: `${room.name} (Cap: ${room.capacity} < Enrollment: ${evt.enrollment})`,
          explanation: `${evt.subjectName} (${evt.sectionNames.join(', ')}) has ${evt.enrollment} students, exceeding ${room.name}'s capacity of ${room.capacity}.`,
          suggestedCorrection: `Move ${sess.eventId} to a ${evt.requiredRoomType} with capacity >= ${evt.enrollment}.`,
        });
      }

      // 3b. Room type mismatch
      if (room.roomType !== evt.requiredRoomType) {
        hardIssues.push({
          id: `HARD-RMTYPE-${sess.eventId}`,
          severity: 'HARD',
          category: 'ROOM_TYPE_MISMATCH',
          title: 'Incompatible Room Type',
          affectedEventIds: [sess.eventId],
          dayAndTime: sess.occupiedSlotKeys.join(', '),
          affectedEntities: `${room.name} (${room.roomType})`,
          explanation: `${evt.subjectName} requires a "${evt.requiredRoomType}", but was assigned to "${room.name}" (${room.roomType}).`,
          suggestedCorrection: `Assign ${sess.eventId} to a room of type "${evt.requiredRoomType}".`,
        });
      }
    }

    // 3c. Check each occupied slot for breaks, teacher availability, section availability, room availability
    for (const slotKey of sess.occupiedSlotKeys) {
      const [dayPart, pPart] = slotKey.split('-P');
      const pNum = Number(pPart);
      const periodDef = periodMap.get(pNum);

      if (!periodDef || periodDef.isBreak || calUnavailable.has(slotKey)) {
        hardIssues.push({
          id: `HARD-BREAK-${sess.eventId}-${slotKey}`,
          severity: 'HARD',
          category: 'BREAK_PERIOD_ASSIGNED',
          title: 'Scheduled During Break or Non-Teaching Slot',
          affectedEventIds: [sess.eventId],
          dayAndTime: slotKey,
          affectedEntities: `${evt.subjectCode} (${evt.sectionNames.join(', ')})`,
          explanation: `Event ${sess.eventId} is scheduled during ${slotKey}, which is a break or institutionally unavailable period.`,
          suggestedCorrection: 'Reschedule to an active teaching period.',
        });
      }

      if (teacher && teacher.unavailableSlots.includes(slotKey)) {
        hardIssues.push({
          id: `HARD-TCHUNAVAIL-${sess.eventId}-${slotKey}`,
          severity: 'HARD',
          category: 'TEACHER_UNAVAILABLE',
          title: 'Teacher Availability Violation',
          affectedEventIds: [sess.eventId],
          dayAndTime: slotKey,
          affectedEntities: teacher.name,
          explanation: `${teacher.name} is marked unavailable during ${slotKey}, but ${sess.eventId} (${evt.subjectCode}) is scheduled then.`,
          suggestedCorrection: `Move ${sess.eventId} to a time slot when ${teacher.name} is available.`,
        });
      }

      for (const secId of evt.sectionIds) {
        const sec = sectionMap.get(secId);
        if (sec && sec.unavailableSlots.includes(slotKey)) {
          hardIssues.push({
            id: `HARD-SECUNAVAIL-${sess.eventId}-${sec.id}-${slotKey}`,
            severity: 'HARD',
            category: 'SECTION_UNAVAILABLE',
            title: 'Section Availability Violation',
            affectedEventIds: [sess.eventId],
            dayAndTime: slotKey,
            affectedEntities: sec.name,
            explanation: `Student section ${sec.name} is unavailable during ${slotKey}.`,
            suggestedCorrection: `Move ${sess.eventId} to an available slot for ${sec.name}.`,
          });
        }
      }

      if (room && room.unavailableSlots.includes(slotKey)) {
        hardIssues.push({
          id: `HARD-RMUNAVAIL-${sess.eventId}-${room.id}-${slotKey}`,
          severity: 'HARD',
          category: 'ROOM_UNAVAILABLE',
          title: 'Room Availability Violation',
          affectedEventIds: [sess.eventId],
          dayAndTime: slotKey,
          affectedEntities: room.name,
          explanation: `${room.name} is marked unavailable during ${slotKey}.`,
          suggestedCorrection: `Reassign ${sess.eventId} to an available room or different time slot.`,
        });
      }

      // Check day consistency for multi-period events
      if (dayPart !== sess.day) {
        hardIssues.push({
          id: `HARD-LABDAY-${sess.eventId}`,
          severity: 'HARD',
          category: 'LAB_NON_CONSECUTIVE',
          title: 'Multi-Period Session Crosses Days',
          affectedEventIds: [sess.eventId],
          dayAndTime: sess.occupiedSlotKeys.join(', '),
          affectedEntities: evt.subjectCode,
          explanation: `Multi-period session ${sess.eventId} spans across different weekdays.`,
          suggestedCorrection: 'Schedule all periods of a laboratory session consecutively on the same day.',
        });
      }
    }

    // 3d. Check laboratory/multi-period consecutiveness
    if (evt.duration > 1) {
      if (sess.occupiedSlotKeys.length !== evt.duration) {
        hardIssues.push({
          id: `HARD-LABLEN-${sess.eventId}`,
          severity: 'HARD',
          category: 'LAB_NON_CONSECUTIVE',
          title: 'Incomplete Multi-Period Duration',
          affectedEventIds: [sess.eventId],
          dayAndTime: sess.occupiedSlotKeys.join(', '),
          affectedEntities: evt.subjectCode,
          explanation: `${evt.subjectName} requires ${evt.duration} consecutive periods, but only ${sess.occupiedSlotKeys.length} period(s) were allocated.`,
          suggestedCorrection: `Allocate ${evt.duration} consecutive non-break periods on the same day.`,
        });
      } else {
        const periodNums = sess.occupiedSlotKeys.map((k) => Number(k.split('-P')[1]));
        for (let i = 0; i < periodNums.length - 1; i++) {
          if (periodNums[i + 1] !== periodNums[i] + 1) {
            hardIssues.push({
              id: `HARD-LABCONSEC-${sess.eventId}`,
              severity: 'HARD',
              category: 'LAB_NON_CONSECUTIVE',
              title: 'Non-Consecutive Laboratory Periods',
              affectedEventIds: [sess.eventId],
              dayAndTime: sess.occupiedSlotKeys.join(', '),
              affectedEntities: `${evt.subjectCode} (${evt.sectionNames.join(', ')})`,
              explanation: `Laboratory session ${sess.eventId} occupies periods ${periodNums.join(', ')} which are not strictly consecutive or are split by a break.`,
              suggestedCorrection: 'Assign the laboratory to adjacent periods without crossing a break.',
            });
            break;
          }
        }
      }
    }
  }

  // 4. Pairwise overlap checks across all scheduled sessions (Teacher, Section, and Room clashes)
  for (let i = 0; i < scheduledSessions.length; i++) {
    const a = scheduledSessions[i];
    const aSlots = new Set(a.occupiedSlotKeys);

    for (let j = i + 1; j < scheduledSessions.length; j++) {
      const b = scheduledSessions[j];
      const overlappingSlots = b.occupiedSlotKeys.filter((k) => aSlots.has(k));

      if (overlappingSlots.length === 0) continue;

      const slotDesc = overlappingSlots.join(', ');

      // 4a. Teacher clash
      if (a.event.teacherId === b.event.teacherId) {
        hardIssues.push({
          id: `HARD-TCHCLASH-${a.eventId}-${b.eventId}`,
          severity: 'HARD',
          category: 'TEACHER_CLASH',
          title: 'Teacher Double-Booked Clash',
          affectedEventIds: [a.eventId, b.eventId],
          dayAndTime: slotDesc,
          affectedEntities: a.event.teacherName,
          explanation: `${a.event.teacherName} is assigned to both ${a.event.subjectCode} (${a.event.sectionNames.join(',')}) and ${b.event.subjectCode} (${b.event.sectionNames.join(',')}) simultaneously during ${slotDesc}.`,
          suggestedCorrection: `Move either ${a.eventId} or ${b.eventId} to a different time slot color.`,
        });
      }

      // 4b. Student section clash
      const sharedSections = a.event.sectionIds.filter((secId) =>
        b.event.sectionIds.includes(secId)
      );
      if (sharedSections.length > 0) {
        const secNames = sharedSections
          .map((id) => sectionMap.get(id)?.name || id)
          .join(', ');
        hardIssues.push({
          id: `HARD-SECCLASH-${a.eventId}-${b.eventId}`,
          severity: 'HARD',
          category: 'SECTION_CLASH',
          title: 'Student Section Clash',
          affectedEventIds: [a.eventId, b.eventId],
          dayAndTime: slotDesc,
          affectedEntities: `Section ${secNames}`,
          explanation: `Student section ${secNames} has two simultaneous classes (${a.event.subjectCode} and ${b.event.subjectCode}) during ${slotDesc}.`,
          suggestedCorrection: `Assign distinct time-slot colors to adjacent vertices ${a.eventId} and ${b.eventId}.`,
        });
      }

      // 4c. Classroom clash
      if (a.roomId === b.roomId) {
        hardIssues.push({
          id: `HARD-RMCLASH-${a.eventId}-${b.eventId}`,
          severity: 'HARD',
          category: 'ROOM_CLASH',
          title: 'Classroom Double-Booked Clash',
          affectedEventIds: [a.eventId, b.eventId],
          dayAndTime: slotDesc,
          affectedEntities: a.roomName,
          explanation: `Room ${a.roomName} is allocated to both ${a.event.subjectCode} (${a.event.sectionNames.join(',')}) and ${b.event.subjectCode} (${b.event.sectionNames.join(',')}) during ${slotDesc}.`,
          suggestedCorrection: `Reallocate one event to another available ${a.roomType} or reschedule its time slot.`,
        });
      }
    }
  }

  // Evaluate soft preferences
  const { softIssues, softScore } = evaluateScheduleSoftConstraints(
    scheduledSessions,
    calendar,
    sections,
    teachers,
    softWeights
  );

  // Separate missing session count from active clash violations
  const nonMissingHardViolations = hardIssues.filter(
    (issue) => issue.category !== 'MISSING_REQUIRED_SESSION'
  );

  const isComplete =
    scheduledSessions.length === requiredEvents.length &&
    unscheduledSessions.length === 0 &&
    requiredEvents.length > 0;

  const isFullyValid = isComplete && hardIssues.length === 0;

  let statusLabel: ValidationSummary['statusLabel'] = 'Fully Valid — Conflict-Free Timetable';
  if (requiredEvents.length === 0) {
    statusLabel = 'Not Generated Yet';
  } else if (nonMissingHardViolations.length > 0) {
    statusLabel = 'Invalid — Hard Constraint Violations Detected';
  } else if (!isComplete) {
    statusLabel = 'Partial Schedule — Unscheduled Sessions Remain';
  }

  return {
    isFullyValid,
    statusLabel,
    hardViolationsCount: hardIssues.length,
    softWarningsCount: softIssues.length,
    totalRequiredEvents: requiredEvents.length,
    scheduledEventsCount: scheduledSessions.length,
    unscheduledEventsCount: requiredEvents.length - scheduledSessions.length,
    issues: [...hardIssues, ...softIssues],
    softScore,
  };
}
