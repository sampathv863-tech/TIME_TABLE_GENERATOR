import {
  AcademicCalendar,
  ClassSessionEvent,
  ScheduledSession,
  SoftConstraintWeights,
  SoftScoreBreakdown,
  StudentSection,
  Teacher,
  TimeSlot,
  ValidationIssue,
} from '../types/timetable';

/**
 * Computes a soft-preference penalty score for assigning `event` to `candidateSlots`
 * given the already scheduled sessions (`currentSchedule`).
 * Lower penalty is better (0 = ideal slot).
 */
export function computeSlotSoftPenalty(
  event: ClassSessionEvent,
  candidateSlots: TimeSlot[],
  currentSchedule: ScheduledSession[],
  teachers: Teacher[],
  softWeights: SoftConstraintWeights
): number {
  let penalty = 0;
  const startSlot = candidateSlots[0];
  const day = startSlot.day;

  // 1. Distribute repeated subject sessions across different days
  const sameSubjectSameDayCount = currentSchedule.filter(
    (s) => s.event.subjectId === event.subjectId && s.day === day
  ).length;

  if (sameSubjectSameDayCount >= event.maxSessionsPerDay) {
    penalty += softWeights.distributeSubjectDays.enabled
      ? softWeights.distributeSubjectDays.weight * 3
      : 15;
  } else if (sameSubjectSameDayCount > 0) {
    penalty += softWeights.distributeSubjectDays.enabled
      ? softWeights.distributeSubjectDays.weight * 2
      : 10;
  }

  // 2. Avoid consecutive same-subject sessions
  if (softWeights.avoidConsecutiveSameSubject.enabled) {
    const adjacentSameSubject = currentSchedule.some(
      (s) =>
        s.event.subjectId === event.subjectId &&
        s.day === day &&
        (Math.abs(s.endPeriodNumber - startSlot.periodNumber) === 1 ||
          Math.abs(candidateSlots[candidateSlots.length - 1].periodNumber - s.startPeriodNumber) === 1)
    );
    if (adjacentSameSubject) {
      penalty += softWeights.avoidConsecutiveSameSubject.weight * 2;
    }
  }

  // 3. Respect preferred days and time slots
  if (softWeights.respectPreferredSlots.enabled) {
    if (event.preferredDays.length > 0 && !event.preferredDays.includes(day)) {
      penalty += softWeights.respectPreferredSlots.weight;
    }
    if (
      event.preferredSlots.length > 0 &&
      !event.preferredSlots.includes(startSlot.slotKey)
    ) {
      penalty += Math.round(softWeights.respectPreferredSlots.weight * 0.5);
    }
  }

  // 4. Balance teacher daily load
  if (softWeights.balanceTeacherDailyLoad.enabled) {
    const teacher = teachers.find((t) => t.id === event.teacherId);
    const maxLoad = teacher?.maxDailyLoad || 4;
    const currentTeacherPeriodsOnDay = currentSchedule
      .filter((s) => s.event.teacherId === event.teacherId && s.day === day)
      .reduce((sum, s) => sum + s.event.duration, 0);

    if (currentTeacherPeriodsOnDay + event.duration > maxLoad) {
      penalty += softWeights.balanceTeacherDailyLoad.weight * 2;
    } else {
      // Slight preference for days where teacher has fewer classes
      penalty += currentTeacherPeriodsOnDay * 2;
    }
  }

  // 5. Prefer earlier periods slightly to keep schedules compact & reduce isolated gaps
  if (softWeights.minimizeSectionGaps.enabled) {
    const sectionSessionsOnDay = currentSchedule.filter(
      (s) =>
        s.day === day &&
        s.event.sectionIds.some((secId) => event.sectionIds.includes(secId))
    );
    if (sectionSessionsOnDay.length > 0) {
      const existingPeriods = sectionSessionsOnDay.flatMap((s) =>
        s.occupiedSlotKeys.map((k) => Number(k.split('-P')[1]))
      );
      const minP = Math.min(...existingPeriods, startSlot.periodNumber);
      const maxP = Math.max(
        ...existingPeriods,
        candidateSlots[candidateSlots.length - 1].periodNumber
      );
      const span = maxP - minP + 1;
      const totalOccupied = existingPeriods.length + event.duration;
      const gapCount = Math.max(0, span - totalOccupied);
      penalty += gapCount * Math.round(softWeights.minimizeSectionGaps.weight * 0.5);
    }
  }

  // Slight deterministic tie-breaker favoring balanced weekday spread and earlier periods
  const sectionDayLoad = currentSchedule
    .filter(
      (s) =>
        s.day === day &&
        s.event.sectionIds.some((secId) => event.sectionIds.includes(secId))
    )
    .reduce((sum, s) => sum + s.event.duration, 0);

  penalty += sectionDayLoad * 1.5 + startSlot.periodNumber * 0.25;

  return penalty;
}

/**
 * Evaluates all soft preferences on a completed or partial schedule,
 * returning soft warnings and a transparent SoftScoreBreakdown.
 */
export function evaluateScheduleSoftConstraints(
  scheduledSessions: ScheduledSession[],
  calendar: AcademicCalendar,
  sections: StudentSection[],
  teachers: Teacher[],
  softWeights: SoftConstraintWeights
): { softIssues: ValidationIssue[]; softScore: SoftScoreBreakdown } {
  const softIssues: ValidationIssue[] = [];

  // Criterion 1: Distribute repeated subject sessions over the week
  let sameDaySubjectViolations = 0;
  const bySubjectAndDay = new Map<string, ScheduledSession[]>();
  for (const sess of scheduledSessions) {
    const key = `${sess.event.subjectId}__${sess.day}`;
    const list = bySubjectAndDay.get(key) || [];
    list.push(sess);
    bySubjectAndDay.set(key, list);
  }
  for (const [, list] of bySubjectAndDay.entries()) {
    const maxAllowed = list[0].event.maxSessionsPerDay || 1;
    if (list.length > maxAllowed) {
      sameDaySubjectViolations += list.length - maxAllowed;
      if (softWeights.distributeSubjectDays.enabled) {
        softIssues.push({
          id: `SOFT-SAMEDAY-${list[0].eventId}-${list[0].day}`,
          severity: 'SOFT',
          category: 'SAME_DAY_REPEATED_SUBJECT',
          title: 'Repeated Subject on Same Day',
          affectedEventIds: list.map((s) => s.eventId),
          dayAndTime: `${list[0].day} (Periods ${list.map((s) => s.startPeriodNumber).join(', ')})`,
          affectedEntities: `${list[0].event.subjectCode} (${list[0].event.sectionNames.join(', ')})`,
          explanation: `${list[0].event.subjectName} is scheduled ${list.length} times on ${list[0].day} for ${list[0].event.sectionNames.join(', ')} (preferred max: ${maxAllowed}/day).`,
          suggestedCorrection: `Move one session of ${list[0].event.subjectCode} to another weekday where this subject does not yet meet.`,
        });
      }
    }
  }

  // Criterion 2: Avoid consecutive same-subject sessions (for 1-period lectures)
  let consecutiveSameSubjectCount = 0;
  for (const [, list] of bySubjectAndDay.entries()) {
    if (list.length > 1) {
      const sorted = [...list].sort((a, b) => a.startPeriodNumber - b.startPeriodNumber);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1].startPeriodNumber - sorted[i].endPeriodNumber <= 1) {
          consecutiveSameSubjectCount++;
          if (softWeights.avoidConsecutiveSameSubject.enabled) {
            softIssues.push({
              id: `SOFT-CONSEC-${sorted[i].eventId}-${sorted[i + 1].eventId}`,
              severity: 'SOFT',
              category: 'CONSECUTIVE_SAME_SUBJECT',
              title: 'Back-to-Back Same Subject Lectures',
              affectedEventIds: [sorted[i].eventId, sorted[i + 1].eventId],
              dayAndTime: `${sorted[i].day}, P${sorted[i].startPeriodNumber} & P${sorted[i + 1].startPeriodNumber}`,
              affectedEntities: `${sorted[i].event.subjectCode} (${sorted[i].event.sectionNames.join(', ')})`,
              explanation: `Two separate lecture sessions of ${sorted[i].event.subjectName} occur consecutively on ${sorted[i].day}.`,
              suggestedCorrection: 'Reschedule one of the two sessions to a different day.',
            });
          }
        }
      }
    }
  }

  // Criterion 3: Preferred days / slots
  let preferredMissedCount = 0;
  for (const sess of scheduledSessions) {
    if (
      sess.event.preferredDays.length > 0 &&
      !sess.event.preferredDays.includes(sess.day)
    ) {
      preferredMissedCount++;
      if (softWeights.respectPreferredSlots.enabled) {
        softIssues.push({
          id: `SOFT-PREF-${sess.eventId}`,
          severity: 'SOFT',
          category: 'PREFERRED_SLOT_MISSED',
          title: 'Preferred Day Not Used',
          affectedEventIds: [sess.eventId],
          dayAndTime: `${sess.day} P${sess.startPeriodNumber}`,
          affectedEntities: `${sess.event.subjectCode} (${sess.event.sectionNames.join(', ')})`,
          explanation: `Scheduled on ${sess.day}, whereas preferred days are ${sess.event.preferredDays.join(', ')}.`,
          suggestedCorrection: `If desired, move ${sess.eventId} to an open slot on ${sess.event.preferredDays.join(' or ')}.`,
        });
      }
    }
  }

  // Criterion 4: Teacher daily load balance
  let teacherOverloadCount = 0;
  for (const teacher of teachers) {
    for (const day of calendar.workingDays) {
      const daySessions = scheduledSessions.filter(
        (s) => s.event.teacherId === teacher.id && s.day === day
      );
      const totalPeriods = daySessions.reduce((sum, s) => sum + s.event.duration, 0);
      if (totalPeriods > teacher.maxDailyLoad) {
        teacherOverloadCount += totalPeriods - teacher.maxDailyLoad;
        if (softWeights.balanceTeacherDailyLoad.enabled) {
          softIssues.push({
            id: `SOFT-TCHLOAD-${teacher.id}-${day}`,
            severity: 'SOFT',
            category: 'TEACHER_DAILY_OVERLOAD',
            title: 'Teacher Daily Load Exceeded',
            affectedEventIds: daySessions.map((s) => s.eventId),
            dayAndTime: day,
            affectedEntities: teacher.name,
            explanation: `${teacher.name} is scheduled for ${totalPeriods} periods on ${day}, exceeding their preferred daily maximum of ${teacher.maxDailyLoad} periods.`,
            suggestedCorrection: `Redistribute one of ${teacher.name}'s classes from ${day} to a lighter day.`,
          });
        }
      }
    }
  }

  // Criterion 5: Minimize room changes for a section's lectures
  let roomChangeViolations = 0;
  for (const section of sections) {
    const lectureRooms = new Set(
      scheduledSessions
        .filter(
          (s) =>
            s.event.sectionIds.includes(section.id) &&
            s.event.sessionType === 'Lecture'
        )
        .map((s) => s.roomId)
    );
    if (lectureRooms.size > 2) {
      roomChangeViolations += lectureRooms.size - 2;
      if (softWeights.minimizeRoomChanges.enabled) {
        softIssues.push({
          id: `SOFT-RMCHG-${section.id}`,
          severity: 'SOFT',
          category: 'ROOM_CHANGE_PENALTY',
          title: 'Frequent Classroom Changes for Section',
          affectedEventIds: [],
          dayAndTime: 'Weekly Pattern',
          affectedEntities: section.name,
          explanation: `Section ${section.name} uses ${lectureRooms.size} different classrooms for regular lectures across the week.`,
          suggestedCorrection: `Consolidate lecture room assignments for ${section.name} into 1–2 primary classrooms where possible.`,
        });
      }
    }
  }

  // Criterion 6: Isolated gaps in a section's daily schedule
  let sectionGapCount = 0;
  const nonBreakNumbers = calendar.periods
    .filter((p) => !p.isBreak)
    .map((p) => p.periodNumber)
    .sort((a, b) => a - b);

  for (const section of sections) {
    for (const day of calendar.workingDays) {
      const daySessions = scheduledSessions.filter(
        (s) => s.day === day && s.event.sectionIds.includes(section.id)
      );
      if (daySessions.length <= 1) continue;

      const occupiedSet = new Set<number>();
      for (const s of daySessions) {
        for (const k of s.occupiedSlotKeys) {
          occupiedSet.add(Number(k.split('-P')[1]));
        }
      }

      const occupiedIndices = nonBreakNumbers
        .map((pNum, idx) => (occupiedSet.has(pNum) ? idx : -1))
        .filter((idx) => idx !== -1);

      if (occupiedIndices.length >= 2) {
        const firstIdx = occupiedIndices[0];
        const lastIdx = occupiedIndices[occupiedIndices.length - 1];
        const span = lastIdx - firstIdx + 1;
        const gaps = span - occupiedIndices.length;
        if (gaps >= 2) {
          sectionGapCount += gaps - 1;
          if (softWeights.minimizeSectionGaps.enabled) {
            softIssues.push({
              id: `SOFT-GAP-${section.id}-${day}`,
              severity: 'SOFT',
              category: 'SECTION_ISOLATED_GAP',
              title: 'Idle Gaps in Section Daily Schedule',
              affectedEventIds: daySessions.map((s) => s.eventId),
              dayAndTime: day,
              affectedEntities: section.name,
              explanation: `Section ${section.name} has ${gaps} idle teaching periods between its first and last class on ${day}.`,
              suggestedCorrection: `Compact classes on ${day} toward adjacent periods to reduce student waiting time.`,
            });
          }
        }
      }
    }
  }

  // Calculate transparent weighted quality score
  const criteriaDefinitions = [
    {
      criterion: 'Subject Day Distribution (No Same-Day Repeats)',
      enabled: softWeights.distributeSubjectDays.enabled,
      weight: softWeights.distributeSubjectDays.weight,
      violationsCount: sameDaySubjectViolations,
      unitPenalty: 5,
    },
    {
      criterion: 'Avoid Consecutive Same-Subject Lectures',
      enabled: softWeights.avoidConsecutiveSameSubject.enabled,
      weight: softWeights.avoidConsecutiveSameSubject.weight,
      violationsCount: consecutiveSameSubjectCount,
      unitPenalty: 6,
    },
    {
      criterion: 'Respect Preferred Days & Slots',
      enabled: softWeights.respectPreferredSlots.enabled,
      weight: softWeights.respectPreferredSlots.weight,
      violationsCount: preferredMissedCount,
      unitPenalty: 2.5,
    },
    {
      criterion: 'Teacher Daily Load Balance',
      enabled: softWeights.balanceTeacherDailyLoad.enabled,
      weight: softWeights.balanceTeacherDailyLoad.weight,
      violationsCount: teacherOverloadCount,
      unitPenalty: 5,
    },
    {
      criterion: 'Classroom Consistency (Minimize Room Changes)',
      enabled: softWeights.minimizeRoomChanges.enabled,
      weight: softWeights.minimizeRoomChanges.weight,
      violationsCount: roomChangeViolations,
      unitPenalty: 3,
    },
    {
      criterion: 'Compact Section Schedule (Minimize Idle Gaps)',
      enabled: softWeights.minimizeSectionGaps.enabled,
      weight: softWeights.minimizeSectionGaps.weight,
      violationsCount: sectionGapCount,
      unitPenalty: 3,
    },
  ];

  let maxPossiblePoints = 0;
  let earnedPoints = 0;

  const penalties = criteriaDefinitions.map((item) => {
    const maxPts = item.enabled ? item.weight : 0;
    const rawDeduct = item.enabled ? Math.min(maxPts, Math.round(item.violationsCount * item.unitPenalty)) : 0;
    maxPossiblePoints += maxPts;
    earnedPoints += Math.max(0, maxPts - rawDeduct);

    return {
      criterion: item.criterion,
      enabled: item.enabled,
      weight: item.weight,
      violationsCount: item.violationsCount,
      pointsDeducted: rawDeduct,
      maxCriterionPoints: maxPts,
    };
  });

  const overallScore =
    scheduledSessions.length === 0
      ? 0
      : maxPossiblePoints > 0
      ? Math.max(0, Math.min(100, Math.round((earnedPoints / maxPossiblePoints) * 100)))
      : 100;

  return {
    softIssues,
    softScore: {
      overallScore,
      maxPossiblePoints,
      earnedPoints,
      penalties,
    },
  };
}
