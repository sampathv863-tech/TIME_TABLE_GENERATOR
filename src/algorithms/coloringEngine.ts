import {
  AcademicCalendar,
  AlgorithmResult,
  AlgorithmTraceStep,
  AlgorithmType,
  CandidateRejectionRecord,
  Classroom,
  ClassSessionEvent,
  ConflictGraph,
  ScheduledSession,
  SoftConstraintWeights,
  StudentSection,
  SubjectRequirement,
  Teacher,
  TimeSlot,
  UnscheduledSession,
} from '../types/timetable';
import {
  expandSubjectRequirementsToEvents,
  generateAvailableTimeSlots,
  getConsecutiveSlotsForDuration,
} from './eventGenerator';
import { buildConflictGraph } from './conflictGraph';
import { findAvailableCompatibleRoom } from './roomAllocator';
import { computeSlotSoftPenalty } from './softConstraints';
import { runIndependentTimetableValidator } from './validator';

interface SlotEvaluationResult {
  isFeasible: boolean;
  consecutiveSlots: TimeSlot[] | null;
  allocatedRoom: Classroom | null;
  rejectionRecord: CandidateRejectionRecord | null;
  softPenalty: number;
}

/**
 * Evaluates whether `event` can be assigned starting at `startSlot` given `currentSchedule`
 * and the conflict graph adjacency list.
 */
function evaluateSlotCandidate(
  event: ClassSessionEvent,
  startSlot: TimeSlot,
  calendar: AcademicCalendar,
  allTimeSlots: TimeSlot[],
  sections: StudentSection[],
  teachers: Teacher[],
  classrooms: Classroom[],
  conflictGraph: ConflictGraph,
  currentSchedule: ScheduledSession[],
  softWeights: SoftConstraintWeights,
  useSoftRanking: boolean
): SlotEvaluationResult {
  // 1. Check consecutive periods & break avoidance
  const consecutiveSlots = getConsecutiveSlotsForDuration(
    startSlot,
    event.duration,
    calendar,
    allTimeSlots
  );

  if (!consecutiveSlots) {
    return {
      isFeasible: false,
      consecutiveSlots: null,
      allocatedRoom: null,
      rejectionRecord: {
        slotKey: startSlot.slotKey,
        reasonCategory: 'DURATION_CONSECUTIVE_INVALID',
        explanation: `Requires ${event.duration} consecutive non-break periods on ${startSlot.day}.`,
      },
      softPenalty: Infinity,
    };
  }

  const candidateSlotKeys = consecutiveSlots.map((s) => s.slotKey);

  // 2. Check Graph Coloring constraint: no adjacent vertex in ConflictGraph can share any occupiedSlotKey
  const neighborIds = new Set(conflictGraph.adjacencyMap[event.eventId] || []);
  for (const sched of currentSchedule) {
    if (neighborIds.has(sched.eventId)) {
      const overlap = sched.occupiedSlotKeys.find((k) => candidateSlotKeys.includes(k));
      if (overlap) {
        return {
          isFeasible: false,
          consecutiveSlots,
          allocatedRoom: null,
          rejectionRecord: {
            slotKey: startSlot.slotKey,
            reasonCategory: 'GRAPH_CONFLICT',
            explanation: `Adjacent vertex ${sched.eventId} (${sched.event.subjectCode}) already occupies ${overlap}.`,
          },
          softPenalty: Infinity,
        };
      }
    }
  }

  // 3. Check Teacher Availability across all consecutive slots
  const teacher = teachers.find((t) => t.id === event.teacherId);
  if (teacher) {
    const teacherUnavail = candidateSlotKeys.find((k) =>
      teacher.unavailableSlots.includes(k)
    );
    if (teacherUnavail) {
      return {
        isFeasible: false,
        consecutiveSlots,
        allocatedRoom: null,
        rejectionRecord: {
          slotKey: startSlot.slotKey,
          reasonCategory: 'UNAVAILABLE_TEACHER',
          explanation: `Teacher ${teacher.name} is unavailable at ${teacherUnavail}.`,
        },
        softPenalty: Infinity,
      };
    }
  }

  // 4. Check Section Availability across all consecutive slots
  for (const secId of event.sectionIds) {
    const sec = sections.find((s) => s.id === secId);
    if (sec) {
      const secUnavail = candidateSlotKeys.find((k) =>
        sec.unavailableSlots.includes(k)
      );
      if (secUnavail) {
        return {
          isFeasible: false,
          consecutiveSlots,
          allocatedRoom: null,
          rejectionRecord: {
            slotKey: startSlot.slotKey,
            reasonCategory: 'UNAVAILABLE_SECTION',
            explanation: `Section ${sec.name} is unavailable at ${secUnavail}.`,
          },
          softPenalty: Infinity,
        };
      }
    }
  }

  // 5. Integrated Room Allocation check
  const allocatedRoom = findAvailableCompatibleRoom(
    event,
    candidateSlotKeys,
    classrooms,
    currentSchedule
  );

  if (!allocatedRoom) {
    return {
      isFeasible: false,
      consecutiveSlots,
      allocatedRoom: null,
      rejectionRecord: {
        slotKey: startSlot.slotKey,
        reasonCategory: 'NO_COMPATIBLE_ROOM',
        explanation: `No available ${event.requiredRoomType} with capacity >= ${event.enrollment} during ${candidateSlotKeys.join(', ')}.`,
      },
      softPenalty: Infinity,
    };
  }

  const softPenalty = useSoftRanking
    ? computeSlotSoftPenalty(
        event,
        consecutiveSlots,
        currentSchedule,
        teachers,
        softWeights
      )
    : 0;

  return {
    isFeasible: true,
    consecutiveSlots,
    allocatedRoom,
    rejectionRecord: null,
    softPenalty,
  };
}

function buildSnapshot(
  schedule: ScheduledSession[]
): Record<string, { slotKey: string; colorIndex: number; roomId: string }> {
  const snap: Record<string, { slotKey: string; colorIndex: number; roomId: string }> = {};
  for (const s of schedule) {
    snap[s.eventId] = {
      slotKey: s.startSlotKey,
      colorIndex: s.colorIndex,
      roomId: s.roomId,
    };
  }
  return snap;
}

function diagnoseUnscheduledEvent(
  event: ClassSessionEvent,
  rejections: CandidateRejectionRecord[],
  classrooms: Classroom[]
): UnscheduledSession {
  const compatibleRoomCount = classrooms.filter(
    (r) => r.roomType === event.requiredRoomType && r.capacity >= event.enrollment
  ).length;

  const diagnosticDetails: string[] = [];
  if (compatibleRoomCount === 0) {
    diagnosticDetails.push(
      `Zero rooms of type "${event.requiredRoomType}" have capacity >= ${event.enrollment}.`
    );
  }

  const conflictCount = rejections.filter(
    (r) => r.reasonCategory === 'GRAPH_CONFLICT'
  ).length;
  const teacherUnavailCount = rejections.filter(
    (r) => r.reasonCategory === 'UNAVAILABLE_TEACHER'
  ).length;
  const sectionUnavailCount = rejections.filter(
    (r) => r.reasonCategory === 'UNAVAILABLE_SECTION'
  ).length;
  const roomBusyCount = rejections.filter(
    (r) => r.reasonCategory === 'NO_COMPATIBLE_ROOM'
  ).length;
  const durationInvalidCount = rejections.filter(
    (r) => r.reasonCategory === 'DURATION_CONSECUTIVE_INVALID'
  ).length;

  if (conflictCount > 0) {
    diagnosticDetails.push(
      `${conflictCount} candidate slots blocked by adjacent teacher/section graph conflicts.`
    );
  }
  if (teacherUnavailCount > 0) {
    diagnosticDetails.push(
      `${teacherUnavailCount} candidate slots blocked by ${event.teacherName}'s availability restrictions.`
    );
  }
  if (sectionUnavailCount > 0) {
    diagnosticDetails.push(
      `${sectionUnavailCount} candidate slots blocked by section (${event.sectionNames.join(', ')}) unavailability.`
    );
  }
  if (roomBusyCount > 0) {
    diagnosticDetails.push(
      `${roomBusyCount} candidate slots had no free ${event.requiredRoomType} with capacity >= ${event.enrollment}.`
    );
  }
  if (durationInvalidCount > 0 && event.duration > 1) {
    diagnosticDetails.push(
      `${durationInvalidCount} slots could not provide ${event.duration} consecutive periods without crossing a break or end of day.`
    );
  }

  const primaryReason =
    compatibleRoomCount === 0
      ? `No ${event.requiredRoomType} with capacity >= ${event.enrollment} exists.`
      : diagnosticDetails[0] ||
        'All candidate time slots conflicted with adjacent vertices or resource limits.';

  return {
    eventId: event.eventId,
    event,
    reason: primaryReason,
    diagnosticDetails,
  };
}

/**
 * Algorithm A: Greedy Graph Coloring (Welsh-Powell / Descending Degree Order)
 * Orders vertices deterministically by descending degree (with duration and ID tie-breakers)
 * and assigns the earliest feasible time slot that satisfies graph coloring and room allocation.
 */
function executeGreedyColoring(
  events: ClassSessionEvent[],
  conflictGraph: ConflictGraph,
  allTimeSlots: TimeSlot[],
  calendar: AcademicCalendar,
  sections: StudentSection[],
  teachers: Teacher[],
  classrooms: Classroom[],
  softWeights: SoftConstraintWeights
): {
  scheduled: ScheduledSession[];
  unscheduled: UnscheduledSession[];
  trace: AlgorithmTraceStep[];
  nodesExplored: number;
} {
  const scheduled: ScheduledSession[] = [];
  const unscheduled: UnscheduledSession[] = [];
  const trace: AlgorithmTraceStep[] = [];

  // Sort vertices by descending graph degree, then descending duration, then eventId
  const orderedVertices = [...conflictGraph.vertices].sort((a, b) => {
    if (b.degree !== a.degree) return b.degree - a.degree;
    if (b.event.duration !== a.event.duration) return b.event.duration - a.event.duration;
    return a.eventId.localeCompare(b.eventId);
  });

  let stepCounter = 1;

  for (const vertex of orderedVertices) {
    const evt = vertex.event;
    const rejected: CandidateRejectionRecord[] = [];

    // Find already colored neighbors for trace transparency
    const coloredNeighbors = scheduled
      .filter((s) => vertex.neighbors.includes(s.eventId))
      .map((s) => ({
        neighborId: s.eventId,
        neighborLabel: `${s.event.subjectCode} (${s.event.sectionNames.join(',')})`,
        assignedSlotKey: s.startSlotKey,
        colorIndex: s.colorIndex,
      }));

    const distinctNeighborColors = new Set(coloredNeighbors.map((n) => n.assignedSlotKey)).size;

    // Evaluate all candidate time slots in deterministic order, picking best feasible slot
    // For pure Greedy First-Fit with soft preference tie-breaking among days:
    let chosenEval: { slot: TimeSlot; evalResult: SlotEvaluationResult } | null = null;
    let slotsChecked = 0;

    // First pass: try to find first slot that doesn't repeat the same subject on the same day
    const validCandidates: Array<{ slot: TimeSlot; evalResult: SlotEvaluationResult }> = [];

    for (const slot of allTimeSlots) {
      slotsChecked++;
      const evalResult = evaluateSlotCandidate(
        evt,
        slot,
        calendar,
        allTimeSlots,
        sections,
        teachers,
        classrooms,
        conflictGraph,
        scheduled,
        softWeights,
        true
      );
      if (evalResult.isFeasible) {
        validCandidates.push({ slot, evalResult });
      } else if (evalResult.rejectionRecord) {
        rejected.push(evalResult.rejectionRecord);
      }
    }

    if (validCandidates.length > 0) {
      // Greedy First-Fit prefers earliest feasible slot that doesn't violate same-day subject repeat if possible
      const nonSameDayRepeat = validCandidates.find(
        (c) =>
          !scheduled.some(
            (s) => s.event.subjectId === evt.subjectId && s.day === c.slot.day
          )
      );
      chosenEval = nonSameDayRepeat || validCandidates[0];
    }

    if (chosenEval && chosenEval.evalResult.consecutiveSlots && chosenEval.evalResult.allocatedRoom) {
      const consec = chosenEval.evalResult.consecutiveSlots;
      const room = chosenEval.evalResult.allocatedRoom;
      const newSession: ScheduledSession = {
        eventId: evt.eventId,
        event: evt,
        startSlotKey: chosenEval.slot.slotKey,
        occupiedSlotKeys: consec.map((s) => s.slotKey),
        day: chosenEval.slot.day,
        startPeriodNumber: consec[0].periodNumber,
        endPeriodNumber: consec[consec.length - 1].periodNumber,
        colorIndex: chosenEval.slot.colorIndex,
        roomId: room.id,
        roomName: room.name,
        roomCapacity: room.capacity,
        roomType: room.roomType,
      };
      scheduled.push(newSession);

      trace.push({
        stepNumber: stepCounter++,
        action: 'ASSIGN_COLOR',
        eventId: evt.eventId,
        subjectCode: evt.subjectCode,
        sectionLabel: evt.sectionNames.join(', '),
        degree: vertex.degree,
        saturationDegree: distinctNeighborColors,
        coloredNeighbors,
        candidateSlotsChecked: slotsChecked,
        rejectedSlots: rejected.slice(0, 12),
        chosenSlotKey: newSession.startSlotKey,
        chosenColorIndex: newSession.colorIndex,
        chosenRoomName: room.name,
        selectionReason: `Welsh–Powell Greedy Order (Degree ${vertex.degree}): Assigned earliest conflict-free slot ${newSession.startSlotKey} in ${room.name}.`,
        backtracked: false,
        assignedSnapshot: buildSnapshot(scheduled),
      });
    } else {
      unscheduled.push(diagnoseUnscheduledEvent(evt, rejected, classrooms));
      trace.push({
        stepNumber: stepCounter++,
        action: 'UNSCHEDULABLE',
        eventId: evt.eventId,
        subjectCode: evt.subjectCode,
        sectionLabel: evt.sectionNames.join(', '),
        degree: vertex.degree,
        saturationDegree: distinctNeighborColors,
        coloredNeighbors,
        candidateSlotsChecked: slotsChecked,
        rejectedSlots: rejected.slice(0, 12),
        chosenSlotKey: null,
        chosenColorIndex: null,
        chosenRoomName: null,
        selectionReason: `Greedy coloring could not find any valid slot & room for ${evt.eventId}.`,
        backtracked: false,
        assignedSnapshot: buildSnapshot(scheduled),
      });
    }
  }

  return {
    scheduled,
    unscheduled,
    trace,
    nodesExplored: orderedVertices.length,
  };
}

/**
 * Algorithm B: DSATUR (Degree of Saturation) Graph Coloring Algorithm
 * At each step, dynamically selects the uncolored vertex with the highest saturation degree
 * (number of distinct time-slot colors assigned to its colored neighbors), breaking ties
 * by highest graph degree, longest session duration, and event ID.
 * Uses soft-constraint optimization to choose the highest-quality valid time slot & room.
 */
function executeDsaturColoring(
  events: ClassSessionEvent[],
  conflictGraph: ConflictGraph,
  allTimeSlots: TimeSlot[],
  calendar: AcademicCalendar,
  sections: StudentSection[],
  teachers: Teacher[],
  classrooms: Classroom[],
  softWeights: SoftConstraintWeights
): {
  scheduled: ScheduledSession[];
  unscheduled: UnscheduledSession[];
  trace: AlgorithmTraceStep[];
  nodesExplored: number;
} {
  const scheduled: ScheduledSession[] = [];
  const unscheduled: UnscheduledSession[] = [];
  const trace: AlgorithmTraceStep[] = [];
  const uncoloredIds = new Set(events.map((e) => e.eventId));
  const vertexMap = new Map(conflictGraph.vertices.map((v) => [v.eventId, v]));

  let stepCounter = 1;
  let nodesExplored = 0;

  while (uncoloredIds.size > 0) {
    nodesExplored++;

    // Compute dynamic saturation degree for each remaining uncolored vertex
    let bestVertexId: string | null = null;
    let bestSaturation = -1;
    let bestDegree = -1;
    let bestDuration = -1;

    for (const candId of uncoloredIds) {
      const vertex = vertexMap.get(candId)!;
      const neighborColors = new Set<string>();

      for (const neighId of vertex.neighbors) {
        const neighSched = scheduled.find((s) => s.eventId === neighId);
        if (neighSched) {
          for (const occupiedKey of neighSched.occupiedSlotKeys) {
            neighborColors.add(occupiedKey);
          }
        }
      }

      const sat = neighborColors.size;
      const deg = vertex.degree;
      const dur = vertex.event.duration;

      const isBetter =
        sat > bestSaturation ||
        (sat === bestSaturation && dur > bestDuration) ||
        (sat === bestSaturation && dur === bestDuration && deg > bestDegree) ||
        (sat === bestSaturation &&
          dur === bestDuration &&
          deg === bestDegree &&
          (bestVertexId === null || candId.localeCompare(bestVertexId) < 0));

      if (isBetter) {
        bestVertexId = candId;
        bestSaturation = sat;
        bestDegree = deg;
        bestDuration = dur;
      }
    }

    if (!bestVertexId) break;
    uncoloredIds.delete(bestVertexId);

    const vertex = vertexMap.get(bestVertexId)!;
    const evt = vertex.event;
    const rejected: CandidateRejectionRecord[] = [];
    const feasibleOptions: Array<{ slot: TimeSlot; evalResult: SlotEvaluationResult }> = [];

    const coloredNeighbors = scheduled
      .filter((s) => vertex.neighbors.includes(s.eventId))
      .map((s) => ({
        neighborId: s.eventId,
        neighborLabel: `${s.event.subjectCode} (${s.event.sectionNames.join(',')})`,
        assignedSlotKey: s.startSlotKey,
        colorIndex: s.colorIndex,
      }));

    for (const slot of allTimeSlots) {
      const evalResult = evaluateSlotCandidate(
        evt,
        slot,
        calendar,
        allTimeSlots,
        sections,
        teachers,
        classrooms,
        conflictGraph,
        scheduled,
        softWeights,
        true
      );

      if (evalResult.isFeasible) {
        feasibleOptions.push({ slot, evalResult });
      } else if (evalResult.rejectionRecord) {
        rejected.push(evalResult.rejectionRecord);
      }
    }

    // Sort feasible options by lowest soft-constraint penalty, then earliest colorIndex
    feasibleOptions.sort((a, b) => {
      if (Math.abs(a.evalResult.softPenalty - b.evalResult.softPenalty) > 0.01) {
        return a.evalResult.softPenalty - b.evalResult.softPenalty;
      }
      return a.slot.colorIndex - b.slot.colorIndex;
    });

    if (feasibleOptions.length > 0) {
      const chosen = feasibleOptions[0];
      const consec = chosen.evalResult.consecutiveSlots!;
      const room = chosen.evalResult.allocatedRoom!;

      const newSession: ScheduledSession = {
        eventId: evt.eventId,
        event: evt,
        startSlotKey: chosen.slot.slotKey,
        occupiedSlotKeys: consec.map((s) => s.slotKey),
        day: chosen.slot.day,
        startPeriodNumber: consec[0].periodNumber,
        endPeriodNumber: consec[consec.length - 1].periodNumber,
        colorIndex: chosen.slot.colorIndex,
        roomId: room.id,
        roomName: room.name,
        roomCapacity: room.capacity,
        roomType: room.roomType,
      };
      scheduled.push(newSession);

      trace.push({
        stepNumber: stepCounter++,
        action: 'ASSIGN_COLOR',
        eventId: evt.eventId,
        subjectCode: evt.subjectCode,
        sectionLabel: evt.sectionNames.join(', '),
        degree: vertex.degree,
        saturationDegree: bestSaturation,
        coloredNeighbors,
        candidateSlotsChecked: allTimeSlots.length,
        rejectedSlots: rejected.slice(0, 12),
        chosenSlotKey: newSession.startSlotKey,
        chosenColorIndex: newSession.colorIndex,
        chosenRoomName: room.name,
        selectionReason: `DSATUR selected max saturation vertex (Sat=${bestSaturation}, Deg=${vertex.degree}) and assigned optimal slot ${newSession.startSlotKey} in ${room.name} (${feasibleOptions.length} feasible choices).`,
        backtracked: false,
        assignedSnapshot: buildSnapshot(scheduled),
      });
    } else {
      // Attempt 1-step local repair/backtrack if an already scheduled neighbor can move to free up a slot
      let repaired = false;
      for (const neighSched of [...scheduled]) {
        if (!vertex.neighbors.includes(neighSched.eventId)) continue;

        // Temporarily remove neighSched and see if both evt and neighSched can be scheduled
        const tempSchedule = scheduled.filter((s) => s.eventId !== neighSched.eventId);

        for (const slotForEvt of allTimeSlots) {
          const evalEvt = evaluateSlotCandidate(
            evt,
            slotForEvt,
            calendar,
            allTimeSlots,
            sections,
            teachers,
            classrooms,
            conflictGraph,
            tempSchedule,
            softWeights,
            true
          );
          if (!evalEvt.isFeasible || !evalEvt.consecutiveSlots || !evalEvt.allocatedRoom) {
            continue;
          }

          const tempWithEvt: ScheduledSession = {
            eventId: evt.eventId,
            event: evt,
            startSlotKey: slotForEvt.slotKey,
            occupiedSlotKeys: evalEvt.consecutiveSlots.map((s) => s.slotKey),
            day: slotForEvt.day,
            startPeriodNumber: evalEvt.consecutiveSlots[0].periodNumber,
            endPeriodNumber:
              evalEvt.consecutiveSlots[evalEvt.consecutiveSlots.length - 1].periodNumber,
            colorIndex: slotForEvt.colorIndex,
            roomId: evalEvt.allocatedRoom.id,
            roomName: evalEvt.allocatedRoom.name,
            roomCapacity: evalEvt.allocatedRoom.capacity,
            roomType: evalEvt.allocatedRoom.roomType,
          };

          const scheduleAfterEvt = [...tempSchedule, tempWithEvt];

          // Now find an alternative valid slot for neighSched.event
          for (const altSlotForNeigh of allTimeSlots) {
            if (altSlotForNeigh.slotKey === neighSched.startSlotKey) continue;
            const evalNeigh = evaluateSlotCandidate(
              neighSched.event,
              altSlotForNeigh,
              calendar,
              allTimeSlots,
              sections,
              teachers,
              classrooms,
              conflictGraph,
              scheduleAfterEvt,
              softWeights,
              true
            );
            if (
              evalNeigh.isFeasible &&
              evalNeigh.consecutiveSlots &&
              evalNeigh.allocatedRoom
            ) {
              // Commit local backtrack repair!
              const idx = scheduled.findIndex((s) => s.eventId === neighSched.eventId);
              if (idx !== -1) {
                scheduled[idx] = {
                  eventId: neighSched.eventId,
                  event: neighSched.event,
                  startSlotKey: altSlotForNeigh.slotKey,
                  occupiedSlotKeys: evalNeigh.consecutiveSlots.map((s) => s.slotKey),
                  day: altSlotForNeigh.day,
                  startPeriodNumber: evalNeigh.consecutiveSlots[0].periodNumber,
                  endPeriodNumber:
                    evalNeigh.consecutiveSlots[evalNeigh.consecutiveSlots.length - 1]
                      .periodNumber,
                  colorIndex: altSlotForNeigh.colorIndex,
                  roomId: evalNeigh.allocatedRoom.id,
                  roomName: evalNeigh.allocatedRoom.name,
                  roomCapacity: evalNeigh.allocatedRoom.capacity,
                  roomType: evalNeigh.allocatedRoom.roomType,
                };
              }
              scheduled.push(tempWithEvt);
              repaired = true;

              trace.push({
                stepNumber: stepCounter++,
                action: 'BACKTRACK',
                eventId: evt.eventId,
                subjectCode: evt.subjectCode,
                sectionLabel: evt.sectionNames.join(', '),
                degree: vertex.degree,
                saturationDegree: bestSaturation,
                coloredNeighbors,
                candidateSlotsChecked: allTimeSlots.length,
                rejectedSlots: rejected.slice(0, 8),
                chosenSlotKey: tempWithEvt.startSlotKey,
                chosenColorIndex: tempWithEvt.colorIndex,
                chosenRoomName: tempWithEvt.roomName,
                selectionReason: `DSATUR Local Backtracking: Shifted neighbor ${neighSched.eventId} to ${altSlotForNeigh.slotKey} to free ${tempWithEvt.startSlotKey} for ${evt.eventId}.`,
                backtracked: true,
                assignedSnapshot: buildSnapshot(scheduled),
              });
              break;
            }
          }
          if (repaired) break;
        }
        if (repaired) break;
      }

      if (!repaired) {
        unscheduled.push(diagnoseUnscheduledEvent(evt, rejected, classrooms));
        trace.push({
          stepNumber: stepCounter++,
          action: 'UNSCHEDULABLE',
          eventId: evt.eventId,
          subjectCode: evt.subjectCode,
          sectionLabel: evt.sectionNames.join(', '),
          degree: vertex.degree,
          saturationDegree: bestSaturation,
          coloredNeighbors,
          candidateSlotsChecked: allTimeSlots.length,
          rejectedSlots: rejected.slice(0, 12),
          chosenSlotKey: null,
          chosenColorIndex: null,
          chosenRoomName: null,
          selectionReason: `No conflict-free time slot and compatible room found for ${evt.eventId}.`,
          backtracked: false,
          assignedSnapshot: buildSnapshot(scheduled),
        });
      }
    }
  }

  return {
    scheduled,
    unscheduled,
    trace,
    nodesExplored,
  };
}

/**
 * Algorithm C: Recursive Backtracking Graph Coloring Scheduler with Forward Checking
 * Explores valid assignments with a configurable node search limit to prevent browser hangs.
 */
function executeBacktrackingColoring(
  events: ClassSessionEvent[],
  conflictGraph: ConflictGraph,
  allTimeSlots: TimeSlot[],
  calendar: AcademicCalendar,
  sections: StudentSection[],
  teachers: Teacher[],
  classrooms: Classroom[],
  softWeights: SoftConstraintWeights,
  nodeLimit: number
): {
  scheduled: ScheduledSession[];
  unscheduled: UnscheduledSession[];
  trace: AlgorithmTraceStep[];
  nodesExplored: number;
  searchLimitReached: boolean;
} {
  // Order vertices by most constrained first: duration desc, degree desc, eventId asc
  const orderedVertices = [...conflictGraph.vertices].sort((a, b) => {
    if (b.event.duration !== a.event.duration) return b.event.duration - a.event.duration;
    if (b.degree !== a.degree) return b.degree - a.degree;
    return a.eventId.localeCompare(b.eventId);
  });

  const currentSchedule: ScheduledSession[] = [];
  let bestPartialSchedule: ScheduledSession[] = [];
  const trace: AlgorithmTraceStep[] = [];
  let nodesExplored = 0;
  let searchLimitReached = false;
  let stepCounter = 1;
  const maxTraceSteps = 120; // Keep trace concise and responsive in UI

  function backtrack(index: number): boolean {
    if (currentSchedule.length > bestPartialSchedule.length) {
      bestPartialSchedule = [...currentSchedule];
    }

    if (index >= orderedVertices.length) {
      return true; // All events scheduled!
    }

    if (nodesExplored >= nodeLimit) {
      searchLimitReached = true;
      return false;
    }

    nodesExplored++;
    const vertex = orderedVertices[index];
    const evt = vertex.event;
    const rejected: CandidateRejectionRecord[] = [];
    const candidates: Array<{ slot: TimeSlot; evalResult: SlotEvaluationResult }> = [];

    for (const slot of allTimeSlots) {
      const evalResult = evaluateSlotCandidate(
        evt,
        slot,
        calendar,
        allTimeSlots,
        sections,
        teachers,
        classrooms,
        conflictGraph,
        currentSchedule,
        softWeights,
        true
      );
      if (evalResult.isFeasible) {
        candidates.push({ slot, evalResult });
      } else if (evalResult.rejectionRecord) {
        rejected.push(evalResult.rejectionRecord);
      }
    }

    // Order candidate slots by soft penalty so first complete branch is high quality
    candidates.sort((a, b) => a.evalResult.softPenalty - b.evalResult.softPenalty);

    const coloredNeighbors = currentSchedule
      .filter((s) => vertex.neighbors.includes(s.eventId))
      .map((s) => ({
        neighborId: s.eventId,
        neighborLabel: `${s.event.subjectCode} (${s.event.sectionNames.join(',')})`,
        assignedSlotKey: s.startSlotKey,
        colorIndex: s.colorIndex,
      }));
    const satDeg = new Set(coloredNeighbors.map((n) => n.assignedSlotKey)).size;

    for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
      const cand = candidates[cIdx];
      const consec = cand.evalResult.consecutiveSlots!;
      const room = cand.evalResult.allocatedRoom!;

      const session: ScheduledSession = {
        eventId: evt.eventId,
        event: evt,
        startSlotKey: cand.slot.slotKey,
        occupiedSlotKeys: consec.map((s) => s.slotKey),
        day: cand.slot.day,
        startPeriodNumber: consec[0].periodNumber,
        endPeriodNumber: consec[consec.length - 1].periodNumber,
        colorIndex: cand.slot.colorIndex,
        roomId: room.id,
        roomName: room.name,
        roomCapacity: room.capacity,
        roomType: room.roomType,
      };

      currentSchedule.push(session);

      if (trace.length < maxTraceSteps) {
        trace.push({
          stepNumber: stepCounter++,
          action: cIdx > 0 ? 'BACKTRACK' : 'ASSIGN_COLOR',
          eventId: evt.eventId,
          subjectCode: evt.subjectCode,
          sectionLabel: evt.sectionNames.join(', '),
          degree: vertex.degree,
          saturationDegree: satDeg,
          coloredNeighbors,
          candidateSlotsChecked: allTimeSlots.length,
          rejectedSlots: rejected.slice(0, 10),
          chosenSlotKey: session.startSlotKey,
          chosenColorIndex: session.colorIndex,
          chosenRoomName: room.name,
          selectionReason:
            cIdx > 0
              ? `Backtracking branch #${cIdx + 1}: Trying alternative slot ${session.startSlotKey} in ${room.name}.`
              : `Backtracking DFS (Depth ${index + 1}/${orderedVertices.length}): Assigned ${session.startSlotKey} in ${room.name}.`,
          backtracked: cIdx > 0,
          assignedSnapshot: buildSnapshot(currentSchedule),
        });
      }

      if (backtrack(index + 1)) {
        return true;
      }

      // Undo assignment on backtrack
      currentSchedule.pop();
      if (searchLimitReached) {
        return false;
      }
    }

    return false;
  }

  const foundComplete = backtrack(0);
  const finalScheduled = foundComplete ? currentSchedule : bestPartialSchedule;
  const scheduledIds = new Set(finalScheduled.map((s) => s.eventId));

  const unscheduled: UnscheduledSession[] = [];
  for (const vertex of orderedVertices) {
    if (!scheduledIds.has(vertex.eventId)) {
      const rejected: CandidateRejectionRecord[] = [];
      for (const slot of allTimeSlots) {
        const res = evaluateSlotCandidate(
          vertex.event,
          slot,
          calendar,
          allTimeSlots,
          sections,
          teachers,
          classrooms,
          conflictGraph,
          finalScheduled,
          softWeights,
          false
        );
        if (!res.isFeasible && res.rejectionRecord) {
          rejected.push(res.rejectionRecord);
        }
      }
      const diag = diagnoseUnscheduledEvent(vertex.event, rejected, classrooms);
      if (searchLimitReached) {
        diag.reason = `Backtracking stopped at configured search limit (${nodeLimit} nodes). ${diag.reason}`;
      }
      unscheduled.push(diag);
    }
  }

  return {
    scheduled: finalScheduled,
    unscheduled,
    trace,
    nodesExplored,
    searchLimitReached,
  };
}

/**
 * Main entry point to execute any of the 3 Graph Coloring Algorithms
 * and run the independent Stage 8 Validator on the resulting timetable.
 */
export function runTimetableColoringEngine(
  algorithm: AlgorithmType,
  calendar: AcademicCalendar,
  sections: StudentSection[],
  teachers: Teacher[],
  subjects: SubjectRequirement[],
  classrooms: Classroom[],
  softWeights: SoftConstraintWeights,
  backtrackingNodeLimit = 5000
): AlgorithmResult {
  const startTime = performance.now();

  // Stage 2: Expand weekly sessions into event vertices
  const events = expandSubjectRequirementsToEvents(subjects, teachers, sections);

  // Stage 3: Build the conflict graph
  const conflictGraph = buildConflictGraph(events);

  // Stage 4: Generate available time slots
  const allTimeSlots = generateAvailableTimeSlots(calendar);

  let scheduled: ScheduledSession[] = [];
  let unscheduled: UnscheduledSession[] = [];
  let trace: AlgorithmTraceStep[] = [];
  let nodesExplored = 0;
  let searchLimitReached = false;

  if (algorithm === 'GREEDY') {
    const res = executeGreedyColoring(
      events,
      conflictGraph,
      allTimeSlots,
      calendar,
      sections,
      teachers,
      classrooms,
      softWeights
    );
    scheduled = res.scheduled;
    unscheduled = res.unscheduled;
    trace = res.trace;
    nodesExplored = res.nodesExplored;
  } else if (algorithm === 'DSATUR') {
    const res = executeDsaturColoring(
      events,
      conflictGraph,
      allTimeSlots,
      calendar,
      sections,
      teachers,
      classrooms,
      softWeights
    );
    scheduled = res.scheduled;
    unscheduled = res.unscheduled;
    trace = res.trace;
    nodesExplored = res.nodesExplored;
  } else {
    const res = executeBacktrackingColoring(
      events,
      conflictGraph,
      allTimeSlots,
      calendar,
      sections,
      teachers,
      classrooms,
      softWeights,
      backtrackingNodeLimit
    );
    scheduled = res.scheduled;
    unscheduled = res.unscheduled;
    trace = res.trace;
    nodesExplored = res.nodesExplored;
    searchLimitReached = res.searchLimitReached;
  }

  const endTime = performance.now();
  const executionTimeMs = Math.max(0.1, Number((endTime - startTime).toFixed(2)));

  // Stage 8: Run the Independent Timetable Validator
  const validation = runIndependentTimetableValidator(
    events,
    scheduled,
    unscheduled,
    calendar,
    sections,
    teachers,
    classrooms,
    softWeights
  );

  const distinctSlots = new Set<string>();
  for (const s of scheduled) {
    for (const k of s.occupiedSlotKeys) {
      distinctSlots.add(k);
    }
  }

  const degrees = conflictGraph.vertices.map((v) => v.degree);
  const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;
  const avgDegree =
    degrees.length > 0
      ? Number((degrees.reduce((a, b) => a + b, 0) / degrees.length).toFixed(1))
      : 0;

  const labelMap: Record<AlgorithmType, string> = {
    DSATUR: 'DSATUR (Degree of Saturation)',
    GREEDY: 'Greedy Graph Coloring (Welsh–Powell)',
    BACKTRACKING: 'Backtracking Graph Coloring (DFS + Forward Checking)',
  };

  return {
    algorithm,
    algorithmLabel: labelMap[algorithm],
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    executionTimeMs,
    totalEvents: events.length,
    scheduledSessions: scheduled,
    unscheduledSessions: unscheduled,
    distinctSlotsUsed: distinctSlots.size,
    totalAvailableSlots: allTimeSlots.length,
    validation,
    trace,
    searchLimitReached,
    nodesExplored,
    searchLimitConfigured: backtrackingNodeLimit,
    graphStats: {
      vertexCount: conflictGraph.vertices.length,
      edgeCount: conflictGraph.edges.length,
      maxDegree,
      avgDegree,
    },
  };
}

/**
 * Validates and applies a manual reschedule move in the Timetable Viewer.
 * Rejects any move that would violate a hard constraint and explains the exact reason.
 */
export function validateManualSessionMove(
  sessionToMove: ScheduledSession,
  targetStartSlotKey: string,
  targetRoomId: string,
  allScheduledSessions: ScheduledSession[],
  calendar: AcademicCalendar,
  sections: StudentSection[],
  teachers: Teacher[],
  classrooms: Classroom[]
): {
  valid: boolean;
  errorMessage: string | null;
  updatedSession: ScheduledSession | null;
} {
  const allTimeSlots = generateAvailableTimeSlots(calendar);
  const startSlot = allTimeSlots.find((s) => s.slotKey === targetStartSlotKey);

  if (!startSlot) {
    return {
      valid: false,
      errorMessage: `Target time slot "${targetStartSlotKey}" is a break period or unavailable in the academic calendar.`,
      updatedSession: null,
    };
  }

  const consecutiveSlots = getConsecutiveSlotsForDuration(
    startSlot,
    sessionToMove.event.duration,
    calendar,
    allTimeSlots
  );

  if (!consecutiveSlots) {
    return {
      valid: false,
      errorMessage: `${sessionToMove.event.subjectName} requires ${sessionToMove.event.duration} consecutive non-break periods on the same day. Starting at ${targetStartSlotKey} crosses a break or the end of the day.`,
      updatedSession: null,
    };
  }

  const targetRoom = classrooms.find((r) => r.id === targetRoomId);
  if (!targetRoom) {
    return {
      valid: false,
      errorMessage: 'Selected classroom does not exist.',
      updatedSession: null,
    };
  }

  if (targetRoom.roomType !== sessionToMove.event.requiredRoomType) {
    return {
      valid: false,
      errorMessage: `Room Type Violation: ${sessionToMove.event.subjectName} requires a "${sessionToMove.event.requiredRoomType}", but "${targetRoom.name}" is a "${targetRoom.roomType}".`,
      updatedSession: null,
    };
  }

  if (targetRoom.capacity < sessionToMove.event.enrollment) {
    return {
      valid: false,
      errorMessage: `Room Capacity Violation: "${targetRoom.name}" has capacity ${targetRoom.capacity}, which is smaller than the enrollment of ${sessionToMove.event.enrollment} students.`,
      updatedSession: null,
    };
  }

  const targetSlotKeys = consecutiveSlots.map((s) => s.slotKey);
  const teacher = teachers.find((t) => t.id === sessionToMove.event.teacherId);

  for (const key of targetSlotKeys) {
    if (teacher && teacher.unavailableSlots.includes(key)) {
      return {
        valid: false,
        errorMessage: `Teacher Availability Violation: ${teacher.name} is unavailable during ${key}.`,
        updatedSession: null,
      };
    }

    for (const secId of sessionToMove.event.sectionIds) {
      const sec = sections.find((s) => s.id === secId);
      if (sec && sec.unavailableSlots.includes(key)) {
        return {
          valid: false,
          errorMessage: `Section Availability Violation: Section ${sec.name} is unavailable during ${key}.`,
          updatedSession: null,
        };
      }
    }

    if (targetRoom.unavailableSlots.includes(key)) {
      return {
        valid: false,
        errorMessage: `Room Availability Violation: ${targetRoom.name} is unavailable during ${key}.`,
        updatedSession: null,
      };
    }
  }

  // Check clashes with other scheduled sessions
  const otherSessions = allScheduledSessions.filter(
    (s) => s.eventId !== sessionToMove.eventId
  );

  for (const other of otherSessions) {
    const overlap = other.occupiedSlotKeys.find((k) => targetSlotKeys.includes(k));
    if (!overlap) continue;

    if (other.event.teacherId === sessionToMove.event.teacherId) {
      return {
        valid: false,
        errorMessage: `Teacher Clash: ${sessionToMove.event.teacherName} is already teaching ${other.event.subjectCode} (${other.event.sectionNames.join(',')}) during ${overlap}.`,
        updatedSession: null,
      };
    }

    const sharedSec = other.event.sectionIds.find((id) =>
      sessionToMove.event.sectionIds.includes(id)
    );
    if (sharedSec) {
      return {
        valid: false,
        errorMessage: `Student Section Clash: ${other.event.sectionNames.join(', ')} already has ${other.event.subjectCode} scheduled during ${overlap}.`,
        updatedSession: null,
      };
    }

    if (other.roomId === targetRoom.id) {
      return {
        valid: false,
        errorMessage: `Classroom Clash: ${targetRoom.name} is already occupied by ${other.event.subjectCode} (${other.event.sectionNames.join(',')}) during ${overlap}.`,
        updatedSession: null,
      };
    }
  }

  const updatedSession: ScheduledSession = {
    ...sessionToMove,
    startSlotKey: startSlot.slotKey,
    occupiedSlotKeys: targetSlotKeys,
    day: startSlot.day,
    startPeriodNumber: consecutiveSlots[0].periodNumber,
    endPeriodNumber: consecutiveSlots[consecutiveSlots.length - 1].periodNumber,
    colorIndex: startSlot.colorIndex,
    roomId: targetRoom.id,
    roomName: targetRoom.name,
    roomCapacity: targetRoom.capacity,
    roomType: targetRoom.roomType,
  };

  return {
    valid: true,
    errorMessage: null,
    updatedSession,
  };
}
