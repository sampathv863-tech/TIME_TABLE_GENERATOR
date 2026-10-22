import {
  AcademicCalendar,
  AlgorithmResult,
  AppDataState,
  ScheduledSession,
  ValidationIssue,
} from '../types/timetable';
import { createInitialDemoState } from '../data/demoDataset';
import { runTimetableColoringEngine } from '../algorithms/coloringEngine';

const STORAGE_KEY = 'TIMEGRID_DAA_TIMETABLE_STATE_V1';

export function initializeDefaultStateWithSchedule(): AppDataState {
  const base = createInitialDemoState();
  const dsaturResult = runTimetableColoringEngine(
    'DSATUR',
    base.calendar,
    base.sections,
    base.teachers,
    base.subjects,
    base.classrooms,
    base.softWeights,
    base.backtrackingNodeLimit
  );
  base.latestResult = dsaturResult;
  base.comparisonResults.DSATUR = dsaturResult;
  base.activityLog.unshift({
    id: 'ACT-INIT-DSATUR',
    timestamp: dsaturResult.timestamp,
    action: 'Initial DSATUR Schedule Generated',
    details: `Scheduled ${dsaturResult.scheduledSessions.length}/${dsaturResult.totalEvents} sessions in ${dsaturResult.executionTimeMs}ms (${dsaturResult.validation.hardViolationsCount} hard conflicts).`,
    category: 'ALGORITHM',
  });
  return base;
}

export function loadAppStateFromStorage(): AppDataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = initializeDefaultStateWithSchedule();
      saveAppStateToStorage(initial);
      return initial;
    }

    const parsed = JSON.parse(raw) as Partial<AppDataState>;
    if (
      !parsed ||
      !parsed.calendar ||
      !Array.isArray(parsed.sections) ||
      !Array.isArray(parsed.teachers) ||
      !Array.isArray(parsed.subjects) ||
      !Array.isArray(parsed.classrooms) ||
      !parsed.softWeights
    ) {
      const initial = initializeDefaultStateWithSchedule();
      saveAppStateToStorage(initial);
      return initial;
    }

    return {
      calendar: parsed.calendar,
      sections: parsed.sections,
      teachers: parsed.teachers,
      subjects: parsed.subjects,
      classrooms: parsed.classrooms,
      softWeights: parsed.softWeights,
      preferredAlgorithm: parsed.preferredAlgorithm || 'DSATUR',
      backtrackingNodeLimit: parsed.backtrackingNodeLimit || 5000,
      latestResult: parsed.latestResult || null,
      comparisonResults: parsed.comparisonResults || {
        DSATUR: null,
        GREEDY: null,
        BACKTRACKING: null,
      },
      activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : [],
      isDemoData: Boolean(parsed.isDemoData),
    };
  } catch {
    const fallback = initializeDefaultStateWithSchedule();
    return fallback;
  }
}

export function saveAppStateToStorage(state: AppDataState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Exports scheduled sessions to a clean CSV file with day, period, time range,
 * section, subject code, subject name, teacher, room, and duration.
 */
export function downloadScheduledTimetableCsv(
  scheduledSessions: ScheduledSession[],
  calendar: AcademicCalendar
): void {
  const periodMap = new Map(calendar.periods.map((p) => [p.periodNumber, p]));

  const headers = [
    'Event ID',
    'Day',
    'Start Period',
    'End Period',
    'Time Range',
    'Section(s)',
    'Subject Code',
    'Subject Name',
    'Session Type',
    'Teacher Name',
    'Room Name',
    'Room Type',
    'Duration (Periods)',
    'Slot Color ID',
  ];

  const dayOrder = new Map(calendar.workingDays.map((d, i) => [d, i]));
  const sorted = [...scheduledSessions].sort((a, b) => {
    const dA = dayOrder.get(a.day) ?? 99;
    const dB = dayOrder.get(b.day) ?? 99;
    if (dA !== dB) return dA - dB;
    if (a.startPeriodNumber !== b.startPeriodNumber) {
      return a.startPeriodNumber - b.startPeriodNumber;
    }
    return a.eventId.localeCompare(b.eventId);
  });

  const rows = sorted.map((s) => {
    const startP = periodMap.get(s.startPeriodNumber);
    const endP = periodMap.get(s.endPeriodNumber);
    const timeRange =
      startP && endP ? `${startP.startTime} - ${endP.endTime}` : s.startSlotKey;

    return [
      s.eventId,
      s.day,
      `Period ${s.startPeriodNumber}`,
      `Period ${s.endPeriodNumber}`,
      timeRange,
      s.event.sectionNames.join(' + '),
      s.event.subjectCode,
      s.event.subjectName,
      s.event.sessionType,
      s.event.teacherName,
      s.roomName,
      s.roomType,
      s.event.duration,
      `Color #${s.colorIndex}`,
    ].map(escapeCsvCell);
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  triggerFileDownload('timegrid_scheduled_timetable.csv', csvContent, 'text/csv;charset=utf-8;');
}

/**
 * Exports all validation conflicts and soft warnings to CSV.
 */
export function downloadConflictReportCsv(issues: ValidationIssue[]): void {
  const headers = [
    'Issue ID',
    'Severity',
    'Conflict Category',
    'Title',
    'Affected Event(s)',
    'Day & Time',
    'Affected Teacher / Section / Room',
    'Explanation',
    'Suggested Correction',
  ];

  const rows = issues.map((issue) =>
    [
      issue.id,
      issue.severity,
      issue.category,
      issue.title,
      issue.affectedEventIds.join(' | ') || 'N/A',
      issue.dayAndTime,
      issue.affectedEntities,
      issue.explanation,
      issue.suggestedCorrection,
    ].map(escapeCsvCell)
  );

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  triggerFileDownload('timegrid_conflict_report.csv', csvContent, 'text/csv;charset=utf-8;');
}

/**
 * Exports the entire application configuration and generated timetable as a JSON backup file.
 */
export function exportAppStateToJson(state: AppDataState): void {
  const jsonString = JSON.stringify(state, null, 2);
  triggerFileDownload(
    'timegrid_academic_backup.json',
    jsonString,
    'application/json;charset=utf-8;'
  );
}

/**
 * Validates and parses an uploaded JSON backup file.
 */
export function validateAndParseImportedJson(jsonText: string): {
  valid: boolean;
  error: string | null;
  state: AppDataState | null;
} {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Root JSON structure must be an object.', state: null };
    }
    if (!parsed.calendar || !Array.isArray(parsed.calendar.workingDays) || !Array.isArray(parsed.calendar.periods)) {
      return {
        valid: false,
        error: 'Missing or invalid "calendar" object (requires workingDays and periods).',
        state: null,
      };
    }
    if (!Array.isArray(parsed.sections)) {
      return { valid: false, error: 'Missing or invalid "sections" array.', state: null };
    }
    if (!Array.isArray(parsed.teachers)) {
      return { valid: false, error: 'Missing or invalid "teachers" array.', state: null };
    }
    if (!Array.isArray(parsed.subjects)) {
      return { valid: false, error: 'Missing or invalid "subjects" array.', state: null };
    }
    if (!Array.isArray(parsed.classrooms)) {
      return { valid: false, error: 'Missing or invalid "classrooms" array.', state: null };
    }

    const defaultState = createInitialDemoState();
    const validState: AppDataState = {
      calendar: parsed.calendar,
      sections: parsed.sections,
      teachers: parsed.teachers,
      subjects: parsed.subjects,
      classrooms: parsed.classrooms,
      softWeights: parsed.softWeights || defaultState.softWeights,
      preferredAlgorithm: parsed.preferredAlgorithm || 'DSATUR',
      backtrackingNodeLimit: parsed.backtrackingNodeLimit || 5000,
      latestResult: (parsed.latestResult as AlgorithmResult) || null,
      comparisonResults: parsed.comparisonResults || {
        DSATUR: null,
        GREEDY: null,
        BACKTRACKING: null,
      },
      activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : [],
      isDemoData: Boolean(parsed.isDemoData),
    };

    return { valid: true, error: null, state: validState };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? `Invalid JSON syntax: ${err.message}` : 'Invalid JSON file.',
      state: null,
    };
  }
}
