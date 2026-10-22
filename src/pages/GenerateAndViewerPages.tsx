import React, { useState } from 'react';
import {
  Play,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Printer,
  FileDown,
  Move,
  X,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  AlgorithmResult,
  AlgorithmType,
  AppDataState,
  ClassSessionEvent,
  ConflictGraph,
  InputValidationError,
  NavigationTab,
  ScheduledSession,
  TimeSlot,
} from '../types/timetable';
import { validateManualSessionMove } from '../algorithms/coloringEngine';
import { downloadScheduledTimetableCsv } from '../utils/storageAndExport';

// ============================================================================
// 1. GENERATE TIMETABLE & ALGORITHM COMPARISON PAGE
// ============================================================================
interface GenerateTimetablePageProps {
  state: AppDataState;
  events: ClassSessionEvent[];
  conflictGraph: ConflictGraph;
  availableSlots: TimeSlot[];
  inputErrors: InputValidationError[];
  onRunSingleAlgorithm: (algorithm: AlgorithmType, nodeLimit: number) => void;
  onRunAllComparison: (nodeLimit: number) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const GenerateTimetablePage: React.FC<GenerateTimetablePageProps> = ({
  state,
  events,
  conflictGraph,
  availableSlots,
  inputErrors,
  onRunSingleAlgorithm,
  onRunAllComparison,
  onNavigate,
}) => {
  const [selectedAlg, setSelectedAlg] = useState<AlgorithmType>(
    state.preferredAlgorithm || 'DSATUR'
  );
  const [nodeLimit, setNodeLimit] = useState<number>(
    state.backtrackingNodeLimit || 5000
  );
  const [isRunning, setIsRunning] = useState(false);

  const blockingErrors = inputErrors.filter((e) => e.isBlocking);
  const warnings = inputErrors.filter((e) => !e.isBlocking);

  const handleRunSelected = () => {
    if (blockingErrors.length > 0) return;
    setIsRunning(true);
    setTimeout(() => {
      onRunSingleAlgorithm(selectedAlg, nodeLimit);
      setIsRunning(false);
    }, 60);
  };

  const handleRunComparison = () => {
    if (blockingErrors.length > 0) return;
    setIsRunning(true);
    setTimeout(() => {
      onRunAllComparison(nodeLimit);
      setIsRunning(false);
    }, 60);
  };

  const latest = state.latestResult;
  const compList = (['DSATUR', 'GREEDY', 'BACKTRACKING'] as AlgorithmType[])
    .map((k) => state.comparisonResults[k])
    .filter((r): r is AlgorithmResult => Boolean(r));

  return (
    <div className="space-y-8">
      {/* Header & Algorithm Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Graph Coloring Timetable Generation Engine
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a graph-coloring scheduling algorithm or benchmark all three methods on independent copies of the conflict graph.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunSelected}
              disabled={isRunning || blockingErrors.length > 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              {isRunning ? 'Executing Scheduler...' : `Run ${selectedAlg} Scheduler`}
            </button>
            <button
              onClick={handleRunComparison}
              disabled={isRunning || blockingErrors.length > 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5" />
              Compare All 3 Algorithms
            </button>
            {latest && (
              <button
                onClick={() => onNavigate('viewer')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                Open Timetable Grid
              </button>
            )}
          </div>
        </div>

        {/* 3 Algorithm Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* DSATUR */}
          <div
            onClick={() => setSelectedAlg('DSATUR')}
            className={`p-4 rounded-xl border transition-colors cursor-pointer ${
              selectedAlg === 'DSATUR'
                ? 'border-indigo-600 bg-indigo-50/40'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                DSATUR Algorithm
              </span>
              <span className="text-[11px] font-semibold text-indigo-700">
                Recommended Default
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Dynamically selects the uncolored vertex with the highest{' '}
              <strong>Saturation Degree</strong> (number of distinct time-slot colors already assigned to its neighbors), breaking ties by vertex degree and session duration.
            </p>
            <p className="text-[11px] text-slate-500 mt-2 font-mono">
              Includes soft-preference slot ranking & local repair.
            </p>
          </div>

          {/* Greedy Welsh-Powell */}
          <div
            onClick={() => setSelectedAlg('GREEDY')}
            className={`p-4 rounded-xl border transition-colors cursor-pointer ${
              selectedAlg === 'GREEDY'
                ? 'border-indigo-600 bg-indigo-50/40'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                Greedy Graph Coloring
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Welsh–Powell Order
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Orders vertices statically by descending graph degree before coloring, then assigns the first feasible conflict-free time slot and compatible classroom.
            </p>
            <p className="text-[11px] text-slate-500 mt-2 font-mono">
              Fastest execution; no backtracking recovery.
            </p>
          </div>

          {/* Backtracking */}
          <div
            onClick={() => setSelectedAlg('BACKTRACKING')}
            className={`p-4 rounded-xl border transition-colors cursor-pointer ${
              selectedAlg === 'BACKTRACKING'
                ? 'border-indigo-600 bg-indigo-50/40'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                Backtracking Coloring
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                DFS + Forward Check
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Recursively explores valid slot and room assignments, backtracking when a later vertex has zero valid options, up to a configurable search node limit.
            </p>
            <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <label className="text-[11px] font-semibold text-slate-700">
                Search Limit (Nodes):
              </label>
              <input
                type="number"
                min={100}
                max={50000}
                step={500}
                value={nodeLimit}
                onChange={(e) => setNodeLimit(Number(e.target.value))}
                className="w-24 px-2 py-1 text-xs border border-slate-300 rounded font-mono bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stage 1–8 Pipeline Overview */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          8-Stage Graph Coloring Execution Pipeline
        </h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="font-mono font-bold text-indigo-700">Stage 1 · Input Validation</div>
            <div className="mt-1 text-slate-600">
              {blockingErrors.length === 0
                ? `Passed (${warnings.length} non-blocking warnings)`
                : `${blockingErrors.length} blocking errors found`}
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="font-mono font-bold text-indigo-700">Stage 2 · Session Expansion</div>
            <div className="mt-1 text-slate-600">
              {state.subjects.length} subjects → <span className="font-mono font-semibold">{events.length}</span> weekly session vertices
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="font-mono font-bold text-indigo-700">Stage 3 · Conflict Graph</div>
            <div className="mt-1 text-slate-600 font-mono">
              |V| = {conflictGraph.vertices.length}, |E| = {conflictGraph.edges.length}
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="font-mono font-bold text-indigo-700">Stage 4 · Candidate Colors</div>
            <div className="mt-1 text-slate-600 font-mono">
              k = {availableSlots.length} valid teaching slots
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="font-mono font-bold text-teal-700">Stage 5 · Graph Coloring</div>
            <div className="mt-1 text-slate-600">
              {latest ? `${latest.algorithmLabel}` : 'Awaiting execution'}
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="font-mono font-bold text-teal-700">Stage 6 · Room Allocation</div>
            <div className="mt-1 text-slate-600">
              {latest
                ? `${latest.scheduledSessions.length} rooms allocated conflict-free`
                : `${state.classrooms.length} rooms ready`}
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="font-mono font-bold text-teal-700">Stage 7 · Soft Optimization</div>
            <div className="mt-1 text-slate-600 font-mono">
              Quality Score: {latest ? `${latest.validation.softScore.overallScore}/100` : '—'}
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="font-mono font-bold text-teal-700">Stage 8 · Independent Validator</div>
            <div className="mt-1 text-slate-600">
              {latest ? latest.validation.statusLabel : 'Pending'}
            </div>
          </div>
        </div>

        {/* Display Input Errors or Warnings if any */}
        {inputErrors.length > 0 && (
          <div className="mt-4 space-y-2">
            {inputErrors.map((err) => (
              <div
                key={err.id}
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  err.isBlocking
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">[{err.entityType}: {err.entityName}]</span>{' '}
                  {err.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Algorithm Comparison Table (Real Measured Values) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Empirical Algorithm Comparison Benchmark
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Each algorithm runs against an independent copy of the conflict graph and scheduling state. All metrics are measured during actual execution.
            </p>
          </div>
          <button
            onClick={handleRunComparison}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer whitespace-nowrap shrink-0"
          >
            Re-run All 3 Benchmarks →
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3">Algorithm</th>
                <th className="py-2.5 px-3 text-right">Execution Time</th>
                <th className="py-2.5 px-3 text-right">Required Events</th>
                <th className="py-2.5 px-3 text-right">Scheduled</th>
                <th className="py-2.5 px-3 text-right">Unscheduled</th>
                <th className="py-2.5 px-3 text-right">Occupied Slots</th>
                <th className="py-2.5 px-3 text-right">Hard Violations</th>
                <th className="py-2.5 px-3 text-right">Soft Quality Score</th>
                <th className="py-2.5 px-3">Complete Valid Schedule?</th>
                <th className="py-2.5 px-3">Search Limit Reached?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {compList.map((res) => (
                <tr key={res.algorithm} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {res.algorithmLabel}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800">
                    {res.executionTimeMs.toFixed(2)} ms
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {res.totalEvents}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                    {res.scheduledSessions.length}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {res.unscheduledSessions.length}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {res.distinctSlotsUsed} / {res.totalAvailableSlots}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums">
                    {res.validation.hardViolationsCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-teal-700 tabular-nums">
                    {res.validation.softScore.overallScore} / 100
                  </td>
                  <td className="py-3 px-3">
                    {res.validation.isFullyValid ? (
                      <span className="font-semibold text-emerald-700">
                        Yes (100% Valid)
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-700">
                        Partial ({res.scheduledSessions.length}/{res.totalEvents})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">
                    {res.algorithm === 'BACKTRACKING'
                      ? res.searchLimitReached
                        ? `Yes (Stopped at ${res.searchLimitConfigured} nodes)`
                        : `No (${res.nodesExplored} nodes explored)`
                      : 'N/A (Polynomial Pass)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unscheduled Sessions Diagnostic Panel (If Any) */}
      {latest && latest.unscheduledSessions.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
            Unscheduled Class Sessions ({latest.unscheduledSessions.length} remaining)
          </div>
          <p className="text-xs text-amber-800 mt-1">
            The scheduler never fabricates or forces invalid assignments. Below are the exact constraints preventing these events from being scheduled:
          </p>
          <div className="mt-4 space-y-3">
            {latest.unscheduledSessions.map((u) => (
              <div
                key={u.eventId}
                className="bg-white border border-amber-200 rounded-lg p-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 font-mono">
                    {u.eventId} · {u.event.subjectCode} ({u.event.subjectName})
                  </span>
                  <span className="text-slate-600">
                    Section: {u.event.sectionNames.join(', ')} · Teacher: {u.event.teacherName} · Required: {u.event.duration} period(s) in {u.event.requiredRoomType}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-red-700">{u.reason}</p>
                <ul className="mt-1 list-disc list-inside text-slate-600 space-y-0.5">
                  {u.diagnosticDetails.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. GENERATED TIMETABLE VIEWER PAGE (With Filters & Validated Manual Move)
// ============================================================================
interface TimetableViewerPageProps {
  state: AppDataState;
  availableSlots: TimeSlot[];
  conflictGraph: ConflictGraph;
  onUpdateScheduledSessions: (updated: ScheduledSession[], logMsg: string) => void;
  onNavigate: (tab: NavigationTab) => void;
}

type ViewPerspective = 'SECTION' | 'TEACHER' | 'ROOM' | 'INSTITUTIONAL';

export const TimetableViewerPage: React.FC<TimetableViewerPageProps> = ({
  state,
  availableSlots,
  conflictGraph,
  onUpdateScheduledSessions,
  onNavigate,
}) => {
  const [perspective, setPerspective] = useState<ViewPerspective>('SECTION');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    state.sections[0]?.id || 'ALL'
  );
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');

  // Modal state for clicking an event to inspect details & manually reschedule
  const [activeSession, setActiveSession] = useState<ScheduledSession | null>(null);
  const [targetSlotKey, setTargetSlotKey] = useState<string>('');
  const [targetRoomId, setTargetRoomId] = useState<string>('');
  const [moveFeedback, setMoveFeedback] = useState<{
    type: 'SUCCESS' | 'ERROR';
    message: string;
  } | null>(null);

  const latest = state.latestResult;
  const scheduled = latest ? latest.scheduledSessions : [];

  const handlePerspectiveChange = (mode: ViewPerspective) => {
    setPerspective(mode);
    if (mode === 'SECTION') {
      setSelectedSectionId(state.sections[0]?.id || 'ALL');
      setSelectedTeacherId('ALL');
      setSelectedRoomId('ALL');
    } else if (mode === 'TEACHER') {
      setSelectedSectionId('ALL');
      setSelectedTeacherId(state.teachers[0]?.id || 'ALL');
      setSelectedRoomId('ALL');
    } else if (mode === 'ROOM') {
      setSelectedSectionId('ALL');
      setSelectedTeacherId('ALL');
      setSelectedRoomId(state.classrooms[0]?.id || 'ALL');
    } else {
      setSelectedSectionId('ALL');
      setSelectedTeacherId('ALL');
      setSelectedRoomId('ALL');
    }
  };

  const openSessionModal = (sess: ScheduledSession) => {
    setActiveSession(sess);
    setTargetSlotKey(sess.startSlotKey);
    setTargetRoomId(sess.roomId);
    setMoveFeedback(null);
  };

  const handleCommitManualMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !latest) return;

    const validation = validateManualSessionMove(
      activeSession,
      targetSlotKey,
      targetRoomId,
      latest.scheduledSessions,
      state.calendar,
      state.sections,
      state.teachers,
      state.classrooms
    );

    if (!validation.valid || !validation.updatedSession) {
      setMoveFeedback({
        type: 'ERROR',
        message: validation.errorMessage || 'Move violates a hard constraint.',
      });
      return;
    }

    const nextSessions = latest.scheduledSessions.map((s) =>
      s.eventId === activeSession.eventId ? validation.updatedSession! : s
    );

    onUpdateScheduledSessions(
      nextSessions,
      `Manually rescheduled ${activeSession.eventId} (${activeSession.event.subjectCode}) to ${validation.updatedSession.occupiedSlotKeys.join(', ')} in ${validation.updatedSession.roomName}`
    );

    setActiveSession(validation.updatedSession);
    setMoveFeedback({
      type: 'SUCCESS',
      message: `Validated and moved ${activeSession.eventId} to ${validation.updatedSession.occupiedSlotKeys.join(', ')} (${validation.updatedSession.roomName}) with zero hard conflicts.`,
    });
  };

  const uniqueSubjectCodes = Array.from(
    new Set(state.subjects.map((s) => s.code))
  );

  const visibleDays =
    selectedDay === 'ALL'
      ? state.calendar.workingDays
      : state.calendar.workingDays.filter((d) => d === selectedDay);

  const filteredSessions = scheduled.filter((s) => {
    if (
      selectedSectionId !== 'ALL' &&
      !s.event.sectionIds.includes(selectedSectionId)
    ) {
      return false;
    }
    if (selectedTeacherId !== 'ALL' && s.event.teacherId !== selectedTeacherId) {
      return false;
    }
    if (selectedRoomId !== 'ALL' && s.roomId !== selectedRoomId) {
      return false;
    }
    if (
      selectedSubjectCode !== 'ALL' &&
      s.event.subjectCode !== selectedSubjectCode
    ) {
      return false;
    }
    if (selectedDay !== 'ALL' && s.day !== selectedDay) {
      return false;
    }
    return true;
  });

  if (!latest) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <h2 className="text-lg font-bold text-slate-900">
          No Generated Timetable Available
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Run the Graph Coloring Scheduler first to generate and inspect the weekly timetable.
        </p>
        <button
          onClick={() => onNavigate('generate')}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
        >
          Go to Generate Timetable <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls & Perspective Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Generated Weekly Timetable Viewer
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any scheduled class card to inspect its conflict-graph vertex details or perform a validated manual reschedule.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Perspective Mode Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'SECTION', label: 'Section-wise' },
                  { id: 'TEACHER', label: 'Teacher-wise' },
                  { id: 'ROOM', label: 'Room-wise' },
                  { id: 'INSTITUTIONAL', label: 'Complete Institutional' },
                ] as Array<{ id: ViewPerspective; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handlePerspectiveChange(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    perspective === tab.id
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() =>
                downloadScheduledTimetableCsv(filteredSessions, state.calendar)
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Section Filter
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Student Sections</option>
              {state.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name} ({s.studentStrength} students)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Teacher Filter
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Faculty Members</option>
              {state.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Classroom / Lab Filter
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Classrooms & Labs</option>
              {state.classrooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.roomType}, Cap {r.capacity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Subject Filter
            </label>
            <select
              value={selectedSubjectCode}
              onChange={(e) => setSelectedSubjectCode(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Subjects</option>
              {uniqueSubjectCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Weekday Filter
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Working Days</option>
              {state.calendar.workingDays.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Header */}
      <div className="hidden print-only mb-4 border-b border-slate-300 pb-3">
        <h1 className="text-xl font-bold">{state.calendar.institutionName}</h1>
        <p className="text-xs text-slate-600">
          {state.calendar.department} · {state.calendar.academicYear} ({state.calendar.semester}) · Algorithm: {latest.algorithmLabel}
        </p>
      </div>

      {/* Weekly Timetable Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold text-slate-700">
              <th className="py-3 px-3 w-28 bg-slate-50">Weekday</th>
              {state.calendar.periods.map((period) => (
                <th
                  key={period.periodNumber}
                  className={`py-3 px-2.5 text-center ${
                    period.isBreak ? 'bg-amber-50/70 w-24' : 'bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-slate-900">{period.name}</div>
                  <div className="text-[11px] font-mono font-normal text-slate-500 tabular-nums">
                    {period.startTime} – {period.endTime}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {visibleDays.map((day) => (
              <tr key={day} className="align-top">
                <td className="py-4 px-3 font-bold text-slate-900 bg-slate-50/40 whitespace-nowrap">
                  {day}
                </td>
                {state.calendar.periods.map((period) => {
                  if (period.isBreak) {
                    return (
                      <td
                        key={period.periodNumber}
                        className="py-4 px-2 text-center bg-amber-50/40 text-amber-800 font-medium align-middle"
                      >
                        <div className="text-[11px] uppercase tracking-wider">
                          {period.name}
                        </div>
                      </td>
                    );
                  }

                  const slotKey = `${day}-P${period.periodNumber}`;
                  const cellSessions = filteredSessions.filter((s) =>
                    s.occupiedSlotKeys.includes(slotKey)
                  );

                  if (cellSessions.length === 0) {
                    return (
                      <td
                        key={period.periodNumber}
                        className="py-4 px-2 text-center text-slate-300 font-mono align-middle"
                      >
                        —
                      </td>
                    );
                  }

                  return (
                    <td key={period.periodNumber} className="p-2 space-y-2">
                      {cellSessions.map((sess) => {
                        const isLabSecondPart =
                          sess.event.duration > 1 && sess.startSlotKey !== slotKey;

                        return (
                          <div
                            key={`${sess.eventId}-${slotKey}`}
                            onClick={() => openSessionModal(sess)}
                            className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-indigo-400 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="font-mono font-bold text-xs"
                                style={{ color: sess.event.colorHex }}
                              >
                                {sess.event.subjectCode}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {sess.event.sessionType === 'Laboratory'
                                  ? isLabSecondPart
                                    ? 'Lab (Cont.)'
                                    : 'Lab (2P)'
                                  : 'Lecture'}
                              </span>
                            </div>

                            <div className="font-semibold text-slate-900 text-xs mt-0.5 leading-snug">
                              {sess.event.subjectName}
                            </div>

                            <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800">
                                  {sess.event.sectionNames.join(' + ')}
                                </span>
                                <span className="font-mono text-indigo-700">
                                  {sess.roomName}
                                </span>
                              </div>
                              <div className="text-slate-500 truncate">
                                {sess.event.teacherName}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {period.startTime}–{period.endTime} · Color #{sess.colorIndex}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Event Details & Manual Rescheduling Modal */}
      {activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-mono text-indigo-600 font-semibold">
                  Vertex {activeSession.eventId} · Time-Slot Color #{activeSession.colorIndex}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {activeSession.event.subjectCode}: {activeSession.event.subjectName}
                </h3>
              </div>
              <button
                onClick={() => setActiveSession(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block">Student Section(s)</span>
                <span className="font-bold text-slate-900">
                  {activeSession.event.sectionNames.join(' + ')} ({activeSession.event.enrollment} students)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Assigned Teacher</span>
                <span className="font-bold text-slate-900">
                  {activeSession.event.teacherName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Session Type & Duration</span>
                <span className="font-bold text-slate-900 font-mono">
                  {activeSession.event.sessionType} ({activeSession.event.duration} consecutive period{activeSession.event.duration > 1 ? 's' : ''})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Conflict Graph Degree</span>
                <span className="font-bold text-indigo-700 font-mono">
                  {conflictGraph.adjacencyMap[activeSession.eventId]?.length || 0} conflicting neighbors
                </span>
              </div>
            </div>

            {/* Manual Reschedule Form */}
            <form onSubmit={handleCommitManualMove} className="space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Move className="w-4 h-4 text-indigo-600" />
                Manual Rescheduling (With Hard-Constraint Verification)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Starting Time Slot
                  </label>
                  <select
                    value={targetSlotKey}
                    onChange={(e) => {
                      setTargetSlotKey(e.target.value);
                      setMoveFeedback(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    {availableSlots.map((slot) => (
                      <option key={slot.slotKey} value={slot.slotKey}>
                        {slot.slotKey} ({slot.startTime}–{slot.endTime}) [Color #{slot.colorIndex}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Classroom / Laboratory
                  </label>
                  <select
                    value={targetRoomId}
                    onChange={(e) => {
                      setTargetRoomId(e.target.value);
                      setMoveFeedback(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {state.classrooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomType}, Cap: {r.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeSession.event.duration > 1 && (
                <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-slate-100 p-2.5 rounded-lg">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    Because this is a {activeSession.event.duration}-period laboratory, moving it will automatically claim {activeSession.event.duration} consecutive teaching periods starting from the selected slot without crossing breaks.
                  </span>
                </div>
              )}

              {moveFeedback && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium flex items-start gap-2 ${
                    moveFeedback.type === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {moveFeedback.type === 'SUCCESS' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  )}
                  <span>{moveFeedback.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveSession(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
                >
                  Validate & Commit Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
