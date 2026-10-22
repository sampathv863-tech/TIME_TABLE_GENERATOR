export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export type RoomType = 'Classroom' | 'Computer Lab' | 'Science Lab' | 'Seminar Hall';

export type SessionType = 'Lecture' | 'Laboratory';

export type AlgorithmType = 'DSATUR' | 'GREEDY' | 'BACKTRACKING';

export type NavigationTab =
  | 'dashboard'
  | 'academic-setup'
  | 'sections'
  | 'teachers'
  | 'subjects'
  | 'classrooms'
  | 'generate'
  | 'viewer'
  | 'conflicts'
  | 'graph'
  | 'algorithm-lab'
  | 'reports'
  | 'daa-guide'
  | 'settings';

export interface PeriodDefinition {
  periodNumber: number; // 1-indexed sequential index in the day
  name: string; // e.g., "Period 1", "Lunch Break"
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "09:50"
  isBreak: boolean;
}

export interface AcademicCalendar {
  institutionName: string;
  department: string;
  academicYear: string;
  semester: string;
  workingDays: Weekday[];
  periods: PeriodDefinition[];
  unavailableSlots: string[]; // Array of slotKey strings e.g. "Friday-P6"
}

export interface StudentSection {
  id: string;
  name: string; // e.g. "CSE-A"
  department: string;
  semester: string;
  studentStrength: number;
  unavailableSlots: string[]; // e.g. ["Wednesday-P6"]
}

export interface Teacher {
  id: string;
  name: string;
  department: string;
  qualifiedSubjectCodes: string[];
  unavailableSlots: string[]; // e.g. ["Monday-P1", "Friday-P6"]
  maxDailyLoad: number; // Soft/configurable preference (e.g., 4 periods/day)
}

export interface SubjectRequirement {
  id: string;
  code: string;
  name: string;
  teacherId: string;
  sectionIds: string[]; // Supports single section or combined multi-section class
  sessionsPerWeek: number; // e.g., 3 weekly meetings
  sessionDuration: number; // 1 for standard lecture, 2 (or 3) for consecutive lab periods
  requiredRoomType: RoomType;
  sessionType: SessionType;
  expectedEnrollment: number;
  preferredDays: Weekday[];
  preferredSlots: string[]; // Optional preferred slot keys
  maxSessionsPerDay: number; // Typically 1 for lectures
  colorHex: string;
}

export interface Classroom {
  id: string;
  name: string; // e.g. "Classroom 101"
  roomType: RoomType;
  capacity: number;
  building: string;
  unavailableSlots: string[];
}

/**
 * Represents a single teaching time slot color in the timetable (excluding breaks).
 * Key format: `${day}-P${periodNumber}`
 */
export interface TimeSlot {
  slotKey: string; // e.g., "Monday-P1"
  colorIndex: number; // 1-indexed color ID for graph coloring
  day: Weekday;
  periodNumber: number;
  periodName: string;
  startTime: string;
  endTime: string;
}

/**
 * A single expanded weekly meeting event = 1 Vertex in the Conflict Graph.
 */
export interface ClassSessionEvent {
  eventId: string; // e.g., "EVT-CS301-A-1"
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  sessionIndex: number; // 1..sessionsPerWeek
  totalSessionsForSubject: number;
  teacherId: string;
  teacherName: string;
  sectionIds: string[];
  sectionNames: string[];
  duration: number; // Number of consecutive teaching periods required
  requiredRoomType: RoomType;
  sessionType: SessionType;
  enrollment: number;
  preferredDays: Weekday[];
  preferredSlots: string[];
  maxSessionsPerDay: number;
  colorHex: string;
}

export type ConflictReason = 'SHARED_TEACHER' | 'SHARED_SECTION' | 'SAME_SUBJECT_GROUP';

export interface GraphEdge {
  id: string;
  source: string; // eventId
  target: string; // eventId
  reasons: ConflictReason[];
  details: string; // e.g., "Shared Teacher: Dr. A. Sharma & Section: CSE-A"
}

export interface GraphVertex {
  eventId: string;
  event: ClassSessionEvent;
  degree: number;
  neighbors: string[]; // Adjacent eventIds
}

export interface ConflictGraph {
  vertices: GraphVertex[];
  edges: GraphEdge[];
  adjacencyMap: Record<string, string[]>;
  edgeReasonsMap: Record<string, ConflictReason[]>;
}

/**
 * Represents a scheduled class-session event assigned a starting time-slot color
 * (and consecutive slots if duration > 1) plus a compatible classroom.
 */
export interface ScheduledSession {
  eventId: string;
  event: ClassSessionEvent;
  startSlotKey: string; // Primary color assigned to this vertex
  occupiedSlotKeys: string[]; // Length == event.duration (e.g. ["Tuesday-P2", "Tuesday-P3"])
  day: Weekday;
  startPeriodNumber: number;
  endPeriodNumber: number;
  colorIndex: number;
  roomId: string;
  roomName: string;
  roomCapacity: number;
  roomType: RoomType;
}

export interface UnscheduledSession {
  eventId: string;
  event: ClassSessionEvent;
  reason: string;
  diagnosticDetails: string[];
}

export interface CandidateRejectionRecord {
  slotKey: string;
  reasonCategory: 'GRAPH_CONFLICT' | 'UNAVAILABLE_TEACHER' | 'UNAVAILABLE_SECTION' | 'DURATION_CONSECUTIVE_INVALID' | 'NO_COMPATIBLE_ROOM';
  explanation: string;
}

export interface AlgorithmTraceStep {
  stepNumber: number;
  action: 'SELECT_VERTEX' | 'ASSIGN_COLOR' | 'BACKTRACK' | 'UNSCHEDULABLE';
  eventId: string;
  subjectCode: string;
  sectionLabel: string;
  degree: number;
  saturationDegree: number;
  coloredNeighbors: Array<{
    neighborId: string;
    neighborLabel: string;
    assignedSlotKey: string;
    colorIndex: number;
  }>;
  candidateSlotsChecked: number;
  rejectedSlots: CandidateRejectionRecord[];
  chosenSlotKey: string | null;
  chosenColorIndex: number | null;
  chosenRoomName: string | null;
  selectionReason: string;
  backtracked: boolean;
  assignedSnapshot: Record<string, { slotKey: string; colorIndex: number; roomId: string }>;
}

export type ViolationSeverity = 'HARD' | 'SOFT';

export type ViolationCategory =
  | 'TEACHER_CLASH'
  | 'SECTION_CLASH'
  | 'ROOM_CLASH'
  | 'ROOM_CAPACITY'
  | 'ROOM_TYPE_MISMATCH'
  | 'TEACHER_UNAVAILABLE'
  | 'SECTION_UNAVAILABLE'
  | 'ROOM_UNAVAILABLE'
  | 'BREAK_PERIOD_ASSIGNED'
  | 'LAB_NON_CONSECUTIVE'
  | 'MISSING_REQUIRED_SESSION'
  | 'DUPLICATE_ASSIGNMENT'
  | 'SAME_DAY_REPEATED_SUBJECT'
  | 'CONSECUTIVE_SAME_SUBJECT'
  | 'PREFERRED_SLOT_MISSED'
  | 'TEACHER_DAILY_OVERLOAD'
  | 'ROOM_CHANGE_PENALTY'
  | 'SECTION_ISOLATED_GAP';

export interface ValidationIssue {
  id: string;
  severity: ViolationSeverity;
  category: ViolationCategory;
  title: string;
  affectedEventIds: string[];
  dayAndTime: string;
  affectedEntities: string; // Teacher, section, or room name
  explanation: string;
  suggestedCorrection: string;
}

export interface SoftConstraintWeights {
  distributeSubjectDays: { enabled: boolean; weight: number };
  avoidConsecutiveSameSubject: { enabled: boolean; weight: number };
  respectPreferredSlots: { enabled: boolean; weight: number };
  balanceTeacherDailyLoad: { enabled: boolean; weight: number };
  minimizeRoomChanges: { enabled: boolean; weight: number };
  minimizeSectionGaps: { enabled: boolean; weight: number };
}

export interface SoftScoreBreakdown {
  overallScore: number; // 0 to 100
  maxPossiblePoints: number;
  earnedPoints: number;
  penalties: Array<{
    criterion: string;
    enabled: boolean;
    weight: number;
    violationsCount: number;
    pointsDeducted: number;
    maxCriterionPoints: number;
  }>;
}

export interface ValidationSummary {
  isFullyValid: boolean;
  statusLabel:
    | 'Fully Valid — Conflict-Free Timetable'
    | 'Partial Schedule — Unscheduled Sessions Remain'
    | 'Invalid — Hard Constraint Violations Detected'
    | 'Not Generated Yet';
  hardViolationsCount: number;
  softWarningsCount: number;
  totalRequiredEvents: number;
  scheduledEventsCount: number;
  unscheduledEventsCount: number;
  issues: ValidationIssue[];
  softScore: SoftScoreBreakdown;
}

export interface InputValidationError {
  id: string;
  entityType: 'CALENDAR' | 'SECTION' | 'TEACHER' | 'SUBJECT' | 'ROOM';
  entityName: string;
  message: string;
  isBlocking: boolean;
}

export interface AlgorithmResult {
  algorithm: AlgorithmType;
  algorithmLabel: string;
  timestamp: string;
  executionTimeMs: number;
  totalEvents: number;
  scheduledSessions: ScheduledSession[];
  unscheduledSessions: UnscheduledSession[];
  distinctSlotsUsed: number;
  totalAvailableSlots: number;
  validation: ValidationSummary;
  trace: AlgorithmTraceStep[];
  searchLimitReached: boolean;
  nodesExplored: number;
  searchLimitConfigured: number;
  graphStats: {
    vertexCount: number;
    edgeCount: number;
    maxDegree: number;
    avgDegree: number;
  };
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  category: 'DATA' | 'ALGORITHM' | 'VALIDATION' | 'EXPORT';
}

export interface AppDataState {
  calendar: AcademicCalendar;
  sections: StudentSection[];
  teachers: Teacher[];
  subjects: SubjectRequirement[];
  classrooms: Classroom[];
  softWeights: SoftConstraintWeights;
  preferredAlgorithm: AlgorithmType;
  backtrackingNodeLimit: number;
  latestResult: AlgorithmResult | null;
  comparisonResults: Record<AlgorithmType, AlgorithmResult | null>;
  activityLog: ActivityLogEntry[];
  isDemoData: boolean;
}
