import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  FastForward,
  FileDown,
  Printer,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Database,
} from 'lucide-react';
import {
  AlgorithmTraceStep,
  AlgorithmType,
  AppDataState,
  ClassSessionEvent,
  ConflictGraph,
} from '../types/timetable';
import { runTimetableColoringEngine } from '../algorithms/coloringEngine';
import {
  downloadConflictReportCsv,
  downloadScheduledTimetableCsv,
  exportAppStateToJson,
} from '../utils/storageAndExport';

const PSEUDOCODE_MAP: Record<AlgorithmType, string> = {
  DSATUR: `ALGORITHM DSATUR_Timetable_Scheduler(G = (V, E), Slots, Rooms):
1. Initialize all vertices v in V as UNCOLORED
2. WHILE there exists an uncolored vertex in V:
3.   For each uncolored vertex u:
       Saturation(u) = |{ assignedSlot(w) : w in Adj[u] and w is COLORED }|
4.   Select vertex v* with maximum Saturation(v*)
       Tie-break 1: highest graph Degree(v*)
       Tie-break 2: longest session Duration(v*)
       Tie-break 3: lexicographical EventID(v*)
5.   FeasibleCandidates = []
6.   FOR each startSlot in Slots:
       consecSlots = getConsecutiveNonBreakSlots(startSlot, v*.duration)
       IF consecSlots is valid AND
          no neighbor w in Adj[v*] occupies any slot in consecSlots AND
          Teacher(v*) and Section(v*) are available during consecSlots:
            room = findAvailableCompatibleRoom(v*, consecSlots, Rooms)
            IF room != NULL:
              penalty = computeSoftPreferencePenalty(v*, consecSlots)
              FeasibleCandidates.append({ consecSlots, room, penalty })
7.   IF FeasibleCandidates is not empty:
       Pick candidate (bestSlots, bestRoom) with minimum soft penalty
       Assign v* -> (bestSlots, bestRoom)
     ELSE:
       Attempt 1-step local neighbor shift; if none, mark v* UNSCHEDULED
8. RETURN ScheduledSessions, UnscheduledSessions`,

  GREEDY: `ALGORITHM Greedy_Welsh_Powell_Scheduler(G = (V, E), Slots, Rooms):
1. Compute Degree(v) = |Adj[v]| for every class-session vertex v in V
2. Sort V in descending order of Degree(v)
     (Tie-break by Duration(v) descending, then EventID(v) ascending)
3. FOR each vertex v in SortedVertices:
4.   assigned = FALSE
5.   FOR each startSlot in Slots (in chronological order):
       consecSlots = getConsecutiveNonBreakSlots(startSlot, v.duration)
       IF consecSlots is valid AND
          no colored neighbor w in Adj[v] uses consecSlots AND
          Teacher(v) and Section(v) are available during consecSlots:
            room = findAvailableCompatibleRoom(v, consecSlots, Rooms)
            IF room != NULL:
              Assign v -> (consecSlots, room)
              assigned = TRUE
              BREAK
6.   IF NOT assigned:
       Record v in UnscheduledSessions with rejection diagnostics
7. RETURN ScheduledSessions, UnscheduledSessions`,

  BACKTRACKING: `ALGORITHM Backtracking_Graph_Coloring(G = (V, E), index, Slots, Rooms):
1. IF index == |V|:
     RETURN TRUE  // Complete conflict-free timetable found!
2. IF nodesExplored >= SEARCH_LIMIT:
     searchLimitReached = TRUE
     RETURN FALSE
3. nodesExplored = nodesExplored + 1
4. v = OrderedVertices[index]
5. CandidatePairs = findAllValidSlotAndRoomPairs(v, Slots, Rooms)
6. Sort CandidatePairs by ascending soft-constraint penalty
7. FOR each (consecSlots, room) in CandidatePairs:
     Assign v -> (consecSlots, room)
     IF Backtracking_Graph_Coloring(G, index + 1, Slots, Rooms) == TRUE:
       RETURN TRUE
     Unassign v  // Backtrack!
8. RETURN FALSE`,
};

const MINI_4_EVENT_TRACE: AlgorithmTraceStep[] = [
  {
    stepNumber: 1,
    action: 'ASSIGN_COLOR',
    eventId: 'E1',
    subjectCode: 'MA301',
    sectionLabel: 'CSE-A',
    degree: 2,
    saturationDegree: 0,
    coloredNeighbors: [],
    candidateSlotsChecked: 4,
    rejectedSlots: [],
    chosenSlotKey: 'Monday-P1',
    chosenColorIndex: 1,
    chosenRoomName: 'Classroom 101',
    selectionReason:
      'E1 (Mathematics for CSE-A) has max degree=2 (tied with E3) and lexicographically first ID. Assigned Color #1 (Monday-P1) in Classroom 101.',
    backtracked: false,
    assignedSnapshot: {
      E1: { slotKey: 'Monday-P1', colorIndex: 1, roomId: 'RM-101' },
    },
  },
  {
    stepNumber: 2,
    action: 'ASSIGN_COLOR',
    eventId: 'E3',
    subjectCode: 'MA301',
    sectionLabel: 'CSE-B',
    degree: 2,
    saturationDegree: 1,
    coloredNeighbors: [
      {
        neighborId: 'E1',
        neighborLabel: 'MA301 (CSE-A) — Shared Teacher Dr. Sharma',
        assignedSlotKey: 'Monday-P1',
        colorIndex: 1,
      },
    ],
    candidateSlotsChecked: 4,
    rejectedSlots: [
      {
        slotKey: 'Monday-P1',
        reasonCategory: 'GRAPH_CONFLICT',
        explanation:
          'Adjacent vertex E1 (shared teacher Dr. Sharma) already occupies Monday-P1 (Color #1).',
      },
    ],
    chosenSlotKey: 'Monday-P2',
    chosenColorIndex: 2,
    chosenRoomName: 'Classroom 102',
    selectionReason:
      'E3 has Saturation Degree=1 (neighbor E1 colored with Monday-P1) and Degree=2. Rejected Monday-P1 due to teacher conflict; assigned Color #2 (Monday-P2) in Classroom 102.',
    backtracked: false,
    assignedSnapshot: {
      E1: { slotKey: 'Monday-P1', colorIndex: 1, roomId: 'RM-101' },
      E3: { slotKey: 'Monday-P2', colorIndex: 2, roomId: 'RM-102' },
    },
  },
  {
    stepNumber: 3,
    action: 'ASSIGN_COLOR',
    eventId: 'E2',
    subjectCode: 'CS301',
    sectionLabel: 'CSE-A',
    degree: 1,
    saturationDegree: 1,
    coloredNeighbors: [
      {
        neighborId: 'E1',
        neighborLabel: 'MA301 (CSE-A) — Shared Section CSE-A',
        assignedSlotKey: 'Monday-P1',
        colorIndex: 1,
      },
    ],
    candidateSlotsChecked: 4,
    rejectedSlots: [
      {
        slotKey: 'Monday-P1',
        reasonCategory: 'GRAPH_CONFLICT',
        explanation:
          'Adjacent vertex E1 (shared section CSE-A) already occupies Monday-P1 (Color #1).',
      },
    ],
    chosenSlotKey: 'Monday-P2',
    chosenColorIndex: 2,
    chosenRoomName: 'Classroom 101',
    selectionReason:
      'E2 conflicts with E1 on Monday-P1. Assigned Color #2 (Monday-P2) in Classroom 101 (compatible with E3 which uses Classroom 102).',
    backtracked: false,
    assignedSnapshot: {
      E1: { slotKey: 'Monday-P1', colorIndex: 1, roomId: 'RM-101' },
      E3: { slotKey: 'Monday-P2', colorIndex: 2, roomId: 'RM-102' },
      E2: { slotKey: 'Monday-P2', colorIndex: 2, roomId: 'RM-101' },
    },
  },
  {
    stepNumber: 4,
    action: 'ASSIGN_COLOR',
    eventId: 'E4',
    subjectCode: 'CS303',
    sectionLabel: 'CSE-B',
    degree: 1,
    saturationDegree: 1,
    coloredNeighbors: [
      {
        neighborId: 'E3',
        neighborLabel: 'MA301 (CSE-B) — Shared Section CSE-B',
        assignedSlotKey: 'Monday-P2',
        colorIndex: 2,
      },
    ],
    candidateSlotsChecked: 4,
    rejectedSlots: [],
    chosenSlotKey: 'Monday-P1',
    chosenColorIndex: 1,
    chosenRoomName: 'Classroom 102',
    selectionReason:
      'E4 only conflicts with E3 (Monday-P2). Color #1 (Monday-P1) has zero graph conflicts with E4 and Classroom 102 is free during Monday-P1! Assigned Color #1.',
    backtracked: false,
    assignedSnapshot: {
      E1: { slotKey: 'Monday-P1', colorIndex: 1, roomId: 'RM-101' },
      E3: { slotKey: 'Monday-P2', colorIndex: 2, roomId: 'RM-102' },
      E2: { slotKey: 'Monday-P2', colorIndex: 2, roomId: 'RM-101' },
      E4: { slotKey: 'Monday-P1', colorIndex: 1, roomId: 'RM-102' },
    },
  },
];

// ============================================================================
// 1. STEP-BY-STEP ALGORITHM LAB PAGE
// ============================================================================
interface AlgorithmLabPageProps {
  state: AppDataState;
}

export const AlgorithmLabPage: React.FC<AlgorithmLabPageProps> = ({ state }) => {
  const [traceDatasetMode, setTraceDatasetMode] = useState<'FULL' | 'MINI_4'>('FULL');
  const [selectedAlg, setSelectedAlg] = useState<AlgorithmType>('DSATUR');
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Execute real algorithm trace on demand when user switches algorithm in the lab
  const computedResult = useMemo(() => {
    return runTimetableColoringEngine(
      selectedAlg,
      state.calendar,
      state.sections,
      state.teachers,
      state.subjects,
      state.classrooms,
      state.softWeights,
      state.backtrackingNodeLimit
    );
  }, [
    selectedAlg,
    state.calendar,
    state.sections,
    state.teachers,
    state.subjects,
    state.classrooms,
    state.softWeights,
    state.backtrackingNodeLimit,
  ]);

  const activeTrace: AlgorithmTraceStep[] =
    traceDatasetMode === 'MINI_4' ? MINI_4_EVENT_TRACE : computedResult.trace;

  useEffect(() => {
    setStepIndex(0);
    setIsPlaying(false);
  }, [selectedAlg, traceDatasetMode]);

  useEffect(() => {
    if (!isPlaying) return;
    if (stepIndex >= activeTrace.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setStepIndex((prev) => Math.min(activeTrace.length - 1, prev + 1));
    }, 850);
    return () => clearTimeout(timer);
  }, [isPlaying, stepIndex, activeTrace.length]);

  const currentStep: AlgorithmTraceStep | undefined = activeTrace[stepIndex];

  const graphRejected =
    currentStep?.rejectedSlots.filter((r) => r.reasonCategory === 'GRAPH_CONFLICT') ||
    [];
  const resourceRejected =
    currentStep?.rejectedSlots.filter((r) => r.reasonCategory !== 'GRAPH_CONFLICT') ||
    [];

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Step-by-Step Graph Coloring Algorithm Lab
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect actual recorded execution traces step by step: vertex selection, saturation degree, rejected slots, and room allocation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dataset Mode Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                onClick={() => setTraceDatasetMode('FULL')}
                className={`px-3 py-1.5 font-semibold rounded-md cursor-pointer transition-colors ${
                  traceDatasetMode === 'FULL'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Full Academic Dataset ({computedResult.trace.length} steps)
              </button>
              <button
                onClick={() => setTraceDatasetMode('MINI_4')}
                className={`px-3 py-1.5 font-semibold rounded-md cursor-pointer transition-colors ${
                  traceDatasetMode === 'MINI_4'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                4-Event Beginner Graph (E1–E4)
              </button>
            </div>

            {/* Algorithm Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              {(['DSATUR', 'GREEDY', 'BACKTRACKING'] as AlgorithmType[]).map((alg) => (
                <button
                  key={alg}
                  onClick={() => setSelectedAlg(alg)}
                  className={`px-3 py-1.5 font-semibold rounded-md cursor-pointer transition-colors ${
                    selectedAlg === alg
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  {alg}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (stepIndex >= activeTrace.length - 1) setStepIndex(0);
                setIsPlaying(true);
              }}
              disabled={isPlaying || activeTrace.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {stepIndex > 0 && stepIndex < activeTrace.length - 1 ? 'Resume' : 'Start'}
            </button>

            <button
              onClick={() => setIsPlaying(false)}
              disabled={!isPlaying}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setStepIndex((prev) => Math.max(0, prev - 1));
              }}
              disabled={stepIndex <= 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <SkipBack className="w-3.5 h-3.5" /> Previous Step
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setStepIndex((prev) => Math.min(activeTrace.length - 1, prev + 1));
              }}
              disabled={stepIndex >= activeTrace.length - 1}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" /> Next Step
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setStepIndex(0);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setStepIndex(Math.max(0, activeTrace.length - 1));
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" /> Run to Completion
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-700 tabular-nums">
              Step {activeTrace.length > 0 ? stepIndex + 1 : 0} of {activeTrace.length}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, activeTrace.length - 1)}
              value={stepIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setStepIndex(Number(e.target.value));
              }}
              aria-label="Step Scrubber"
              className="w-36 accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Main Two-Zone Educational Split */}
      {currentStep ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Live Step State & Rejection Diagnostics */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs font-mono font-semibold text-indigo-700">
                  Step #{currentStep.stepNumber} · Action: {currentStep.action}
                  {currentStep.backtracked ? ' (Backtracking Recovery Triggered)' : ''}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                  Considering Vertex: {currentStep.eventId} ({currentStep.subjectCode} · {currentStep.sectionLabel})
                </h2>
              </div>

              <div className="text-right font-mono text-xs">
                {currentStep.chosenSlotKey ? (
                  <span className="font-bold text-emerald-700">
                    Assigned: {currentStep.chosenSlotKey} (Color #{currentStep.chosenColorIndex})
                  </span>
                ) : (
                  <span className="font-bold text-red-600">Unschedulable</span>
                )}
              </div>
            </div>

            {/* Vertex Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="text-slate-500 block">Vertex Degree</span>
                <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                  {currentStep.degree}
                </span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="text-slate-500 block">Saturation Degree</span>
                <span className="text-base font-bold font-mono text-indigo-700 tabular-nums">
                  {currentStep.saturationDegree}
                </span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="text-slate-500 block">Allocated Room</span>
                <span className="text-sm font-bold text-slate-900 truncate block">
                  {currentStep.chosenRoomName || 'None'}
                </span>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="text-slate-500 block">Backtracked?</span>
                <span className="text-sm font-bold font-mono text-slate-900">
                  {currentStep.backtracked ? 'Yes (Reconsidered)' : 'No'}
                </span>
              </div>
            </div>

            {/* Decision Reason */}
            <div className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs text-slate-800">
              <div className="font-bold text-indigo-900 mb-0.5">
                Why This Slot & Vertex Were Chosen:
              </div>
              <p className="leading-relaxed">{currentStep.selectionReason}</p>
            </div>

            {/* Colored Neighbors at this step */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 mb-2">
                Already Colored Neighboring Vertices ({currentStep.coloredNeighbors.length})
              </h3>
              {currentStep.coloredNeighbors.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  Zero adjacent neighbors were colored prior to this step (Saturation Degree = 0).
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {currentStep.coloredNeighbors.map((n) => (
                    <div
                      key={n.neighborId}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono"
                    >
                      <span className="font-bold text-slate-900">{n.neighborId}</span>:{' '}
                      <span className="text-indigo-700 font-semibold">
                        {n.assignedSlotKey} (C#{n.colorIndex})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rejected Slots Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="font-bold text-slate-900 mb-1.5">
                  Slots Rejected Due to Graph Conflicts ({graphRejected.length})
                </div>
                {graphRejected.length === 0 ? (
                  <p className="text-slate-500 text-[11px]">
                    No candidate slots blocked by adjacent vertices before finding a valid slot.
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto text-[11px]">
                    {graphRejected.map((r, i) => (
                      <li key={i} className="text-slate-700">
                        <span className="font-mono font-bold text-red-700">
                          {r.slotKey}
                        </span>
                        : {r.explanation}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="font-bold text-slate-900 mb-1.5">
                  Slots Rejected Due to Availability / Room / Duration ({resourceRejected.length})
                </div>
                {resourceRejected.length === 0 ? (
                  <p className="text-slate-500 text-[11px]">
                    No slots blocked by room capacity or teacher/section unavailability.
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto text-[11px]">
                    {resourceRejected.map((r, i) => (
                      <li key={i} className="text-slate-700">
                        <span className="font-mono font-bold text-amber-700">
                          {r.slotKey}
                        </span>
                        : {r.explanation}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Algorithm Pseudocode & Cumulative Coloring Progress */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedAlg} Algorithm Pseudocode
                </h3>
              </div>
              <pre className="mt-3 p-3.5 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {PSEUDOCODE_MAP[selectedAlg]}
              </pre>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-slate-900">
                Colored Vertices After Step #{currentStep.stepNumber} (
                {Object.keys(currentStep.assignedSnapshot).length} colored)
              </h3>
              <div className="mt-3 max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs font-mono">
                {Object.entries(currentStep.assignedSnapshot).map(([evtId, info]) => (
                  <div
                    key={evtId}
                    className={`py-1.5 flex items-center justify-between ${
                      evtId === currentStep.eventId
                        ? 'text-indigo-700 font-bold'
                        : 'text-slate-700'
                    }`}
                  >
                    <span>{evtId}</span>
                    <span>
                      {info.slotKey} · Color #{info.colorIndex} · {info.roomId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          No trace steps available. Add subjects to the dataset to execute the algorithm.
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. REPORTS & EXPORTS PAGE (Section 16)
// ============================================================================
interface ReportsPageProps {
  state: AppDataState;
  events: ClassSessionEvent[];
  conflictGraph: ConflictGraph;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  state,
  events,
  conflictGraph,
}) => {
  const latest = state.latestResult;
  const scheduled = latest ? latest.scheduledSessions : [];
  const totalSlotsPerRoom = state.calendar.workingDays.length * state.calendar.periods.filter((p) => !p.isBreak).length;

  const usedTeacherIds = new Set(scheduled.map((s) => s.event.teacherId));
  const usedRoomIds = new Set(scheduled.map((s) => s.roomId));

  return (
    <div className="space-y-8">
      {/* Header & Working Export Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Analytical Reports, Soft-Constraint Breakdown & Exports
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Download scheduled sessions as CSV, export the conflict audit report, save a JSON backup, or print an academic evaluation report.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => downloadScheduledTimetableCsv(scheduled, state.calendar)}
              disabled={scheduled.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" /> Timetable CSV
            </button>
            <button
              onClick={() =>
                downloadConflictReportCsv(latest?.validation.issues || [])
              }
              disabled={!latest}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" /> Conflict Report CSV
            </button>
            <button
              onClick={() => exportAppStateToJson(state)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5" /> JSON Backup
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* Print-Mode Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 print-break-inside-avoid">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono font-bold text-indigo-700">
              OFFICIAL ACADEMIC SCHEDULING REPORT — TIMEGRID DAA
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {state.calendar.institutionName}
            </h2>
            <p className="text-xs text-slate-600">
              {state.calendar.department} · {state.calendar.academicYear} ({state.calendar.semester})
            </p>
          </div>
          <div className="text-xs font-mono text-slate-600 sm:text-right">
            <div>Algorithm: {latest ? latest.algorithmLabel : 'None'}</div>
            <div>Execution Time: {latest ? `${latest.executionTimeMs} ms` : '—'}</div>
            <div className="font-bold text-emerald-700">
              {latest ? latest.validation.statusLabel : 'Unscheduled'}
            </div>
          </div>
        </div>

        {/* Summary Metrics Table */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Required / Scheduled / Unscheduled</span>
            <span className="mt-1 text-base font-bold font-mono text-slate-900 block tabular-nums">
              {events.length} req · {scheduled.length} sched · {events.length - scheduled.length} unsched
            </span>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Teachers & Rooms Utilized</span>
            <span className="mt-1 text-base font-bold font-mono text-slate-900 block tabular-nums">
              {usedTeacherIds.size}/{state.teachers.length} teachers · {usedRoomIds.size}/{state.classrooms.length} rooms
            </span>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Conflict Graph (Vertices, Edges)</span>
            <span className="mt-1 text-base font-bold font-mono text-indigo-700 block tabular-nums">
              |V| = {conflictGraph.vertices.length}, |E| = {conflictGraph.edges.length}
            </span>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Distinct Occupied Slots & Conflicts</span>
            <span className="mt-1 text-base font-bold font-mono text-teal-700 block tabular-nums">
              {latest?.distinctSlotsUsed || 0} slots · {latest?.validation.hardViolationsCount || 0} hard / {latest?.validation.softWarningsCount || 0} soft
            </span>
          </div>
        </div>
      </div>

      {/* Classroom Utilization & Teacher Workload Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classroom Utilization */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 print-break-inside-avoid">
          <h2 className="text-base font-bold text-slate-900">
            Classroom & Laboratory Utilization
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Occupied periods out of {totalSlotsPerRoom} weekly teaching periods per room
          </p>

          <div className="mt-4 space-y-3.5 text-xs">
            {state.classrooms.map((room) => {
              const periodsUsed = scheduled
                .filter((s) => s.roomId === room.id)
                .reduce((sum, s) => sum + s.event.duration, 0);
              const pct =
                totalSlotsPerRoom > 0
                  ? Math.round((periodsUsed / totalSlotsPerRoom) * 100)
                  : 0;

              return (
                <div key={room.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {room.name} ({room.roomType}, Cap {room.capacity})
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {periodsUsed} / {totalSlotsPerRoom} periods ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Teacher Workload Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 print-break-inside-avoid">
          <h2 className="text-base font-bold text-slate-900">
            Faculty Teaching Workload Distribution
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Weekly periods assigned and weekday distribution per teacher
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-2 px-2">Teacher</th>
                  <th className="py-2 px-2 text-right">Sessions</th>
                  <th className="py-2 px-2 text-right">Weekly Periods</th>
                  <th className="py-2 px-2 text-right">Max Daily Cap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {state.teachers.map((t) => {
                  const tSessions = scheduled.filter(
                    (s) => s.event.teacherId === t.id
                  );
                  const totalPeriods = tSessions.reduce(
                    (acc, s) => acc + s.event.duration,
                    0
                  );
                  return (
                    <tr key={t.id}>
                      <td className="py-2.5 px-2 font-semibold text-slate-900">
                        {t.name}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                        {tSessions.length}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-indigo-700 tabular-nums">
                        {totalPeriods} periods
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-500 tabular-nums">
                        ≤ {t.maxDailyLoad}/day
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section-wise & Weekday Distribution + Soft-Constraint Scoring Formula */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 print-break-inside-avoid">
          <h2 className="text-base font-bold text-slate-900">
            Section & Weekday Session Distribution
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Number of teaching periods scheduled per student section across working days
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-2 px-2">Section</th>
                  {state.calendar.workingDays.map((d) => (
                    <th key={d} className="py-2 px-2 text-right">
                      {d.slice(0, 3)}
                    </th>
                  ))}
                  <th className="py-2 px-2 text-right">Total Periods</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {state.sections.map((sec) => {
                  let totalSecPeriods = 0;
                  return (
                    <tr key={sec.id}>
                      <td className="py-2.5 px-2 font-sans font-bold text-slate-900">
                        {sec.name}
                      </td>
                      {state.calendar.workingDays.map((day) => {
                        const pCount = scheduled
                          .filter(
                            (s) =>
                              s.day === day &&
                              s.event.sectionIds.includes(sec.id)
                          )
                          .reduce((acc, s) => acc + s.event.duration, 0);
                        totalSecPeriods += pCount;
                        return (
                          <td
                            key={day}
                            className="py-2.5 px-2 text-right tabular-nums text-slate-700"
                          >
                            {pCount}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-2 text-right font-bold text-indigo-700 tabular-nums">
                        {totalSecPeriods}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Soft Constraint Quality Score Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 print-break-inside-avoid">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Soft-Constraint Schedule Quality Score
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Formula: Score = round((EarnedPoints / MaxEnabledWeight) × 100). Heuristic quality indicator, not a proof of mathematical optimality.
              </p>
            </div>
            <span className="text-xl font-bold font-mono text-teal-700 tabular-nums">
              {latest ? `${latest.validation.softScore.overallScore}/100` : '—'}
            </span>
          </div>

          {latest && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-2 px-2">Preference Criterion</th>
                    <th className="py-2 px-2 text-right">Violations</th>
                    <th className="py-2 px-2 text-right">Points Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {latest.validation.softScore.penalties.map((p, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-2 text-slate-800">
                        {p.criterion}{' '}
                        {!p.enabled && (
                          <span className="text-slate-400">(Disabled)</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">
                        {p.violationsCount}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold tabular-nums">
                        {p.maxCriterionPoints - p.pointsDeducted} / {p.maxCriterionPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
