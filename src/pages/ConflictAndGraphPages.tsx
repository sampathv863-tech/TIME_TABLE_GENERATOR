import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileDown,
  Network,
  Eye,
  BookOpen,
  Info,
} from 'lucide-react';
import {
  AppDataState,
  ClassSessionEvent,
  ConflictGraph,
  GraphVertex,
  ViolationSeverity,
} from '../types/timetable';
import { MINI_EXAMPLE_DATA } from '../data/demoDataset';
import { downloadConflictReportCsv } from '../utils/storageAndExport';

const SLOT_COLOR_PALETTE = [
  '#4f46e5',
  '#0d9488',
  '#0284c7',
  '#7c3aed',
  '#d97706',
  '#059669',
  '#e11d48',
  '#2563eb',
  '#9333ea',
  '#ca8a04',
  '#0891b2',
  '#be123c',
  '#15803d',
  '#4338ca',
  '#b45309',
  '#0f766e',
];

function getSlotColorHex(colorIndex: number | null): string {
  if (!colorIndex || colorIndex < 1) return '#94a3b8';
  return SLOT_COLOR_PALETTE[(colorIndex - 1) % SLOT_COLOR_PALETTE.length];
}

// ============================================================================
// 1. CONFLICT CHECKER PAGE (Independent Stage 8 Validator)
// ============================================================================
interface ConflictCheckerPageProps {
  state: AppDataState;
  events: ClassSessionEvent[];
}

export const ConflictCheckerPage: React.FC<ConflictCheckerPageProps> = ({
  state,
  events,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | ViolationSeverity>('ALL');
  const latest = state.latestResult;
  const validation = latest?.validation;

  const issues = validation?.issues || [];
  const filteredIssues = issues.filter((item) =>
    severityFilter === 'ALL' ? true : item.severity === severityFilter
  );

  const hardCategoriesChecked = [
    { key: 'TEACHER_CLASH', label: 'Teacher Clashes (Simultaneous Classes)' },
    { key: 'SECTION_CLASH', label: 'Student Section / Cohort Clashes' },
    { key: 'ROOM_CLASH', label: 'Classroom Double-Booking Clashes' },
    { key: 'ROOM_CAPACITY', label: 'Room Seating Capacity Adequacy' },
    { key: 'ROOM_TYPE_MISMATCH', label: 'Room Type Compatibility (Classroom vs Lab)' },
    { key: 'TEACHER_UNAVAILABLE', label: 'Teacher Availability Restrictions' },
    { key: 'SECTION_UNAVAILABLE', label: 'Section Availability Restrictions' },
    { key: 'BREAK_PERIOD_ASSIGNED', label: 'Zero Classes During Lunch / Breaks' },
    { key: 'LAB_NON_CONSECUTIVE', label: 'Consecutive Same-Day Laboratory Periods' },
    { key: 'MISSING_REQUIRED_SESSION', label: 'All Weekly Required Sessions Scheduled' },
    { key: 'DUPLICATE_ASSIGNMENT', label: 'No Duplicate Event Assignments' },
    { key: 'ROOM_UNAVAILABLE', label: 'Classroom Maintenance / Slot Availability' },
  ];

  return (
    <div className="space-y-8">
      {/* Validation Summary Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="flex items-start gap-3">
            {validation?.isFullyValid ? (
              <ShieldCheck className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-mono font-semibold text-indigo-700">
                Stage 8 Independent Timetable Validator
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                {validation ? validation.statusLabel : 'No Timetable Generated Yet'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                A schedule is marked fully valid only when every required weekly event is scheduled and zero hard-constraint violations exist.
              </p>
            </div>
          </div>

          {validation && (
            <button
              onClick={() => downloadConflictReportCsv(validation.issues)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" /> Export Conflict Report (CSV)
            </button>
          )}
        </div>

        {/* Summary Counters */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-xs text-slate-500">Hard Violations</div>
            <div
              className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                (validation?.hardViolationsCount ?? 0) === 0
                  ? 'text-emerald-700'
                  : 'text-red-600'
              }`}
            >
              {validation ? validation.hardViolationsCount : '—'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Must be 0 for validity</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-xs text-slate-500">Soft Warnings</div>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-700 tabular-nums">
              {validation ? validation.softWarningsCount : '—'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Non-blocking preferences</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-xs text-slate-500">Scheduled Events</div>
            <div className="mt-1 text-2xl font-bold font-mono text-indigo-700 tabular-nums">
              {validation ? validation.scheduledEventsCount : 0} / {events.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Assigned slot & room</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-xs text-slate-500">Unscheduled Events</div>
            <div className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {validation ? validation.unscheduledEventsCount : events.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Remaining vertices</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 col-span-2 sm:col-span-1">
            <div className="text-xs text-slate-500">Soft Quality Score</div>
            <div className="mt-1 text-2xl font-bold font-mono text-teal-700 tabular-nums">
              {validation ? `${validation.softScore.overallScore} / 100` : '—'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Weighted heuristic score</div>
          </div>
        </div>
      </div>

      {/* 12 Hard Constraint Verification Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          12-Point Hard Constraint Verification Audit
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Every category below is independently audited against the generated timetable entries.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {hardCategoriesChecked.map((cat) => {
            const count = issues.filter(
              (i) => i.severity === 'HARD' && i.category === cat.key
            ).length;
            return (
              <div
                key={cat.key}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/40"
              >
                <div className="flex items-center gap-2">
                  {count === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span className="font-medium text-slate-800">{cat.label}</span>
                </div>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    count === 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {count === 0 ? 'PASS (0)' : `FAIL (${count})`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Conflict & Warning Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Detected Conflicts & Soft Preference Warnings ({filteredIssues.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hard constraint violations invalidate a timetable; soft warnings indicate optional scheduling preferences.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'ALL', label: `All Issues (${issues.length})` },
                {
                  id: 'HARD',
                  label: `Hard Violations (${validation?.hardViolationsCount || 0})`,
                },
                {
                  id: 'SOFT',
                  label: `Soft Warnings (${validation?.softWarningsCount || 0})`,
                },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSeverityFilter(btn.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  severityFilter === btn.id
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="mt-2 text-sm font-bold text-slate-900">
              Zero Issues Found in Selected Filter
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              All checked constraints are satisfied without conflicts.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Severity & Type</th>
                  <th className="py-2.5 px-3">Affected Event(s)</th>
                  <th className="py-2.5 px-3">Day & Time</th>
                  <th className="py-2.5 px-3">Teacher / Section / Room</th>
                  <th className="py-2.5 px-3">Explanation</th>
                  <th className="py-2.5 px-3">Suggested Correction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`font-mono font-bold ${
                          issue.severity === 'HARD'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        [{issue.severity}]
                      </span>{' '}
                      <span className="font-semibold text-slate-900">
                        {issue.title}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {issue.affectedEventIds.join(', ') || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {issue.dayAndTime}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {issue.affectedEntities}
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs">
                      {issue.explanation}
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs">
                      {issue.suggestedCorrection}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. INTERACTIVE GRAPH VISUALIZER + 4-EVENT EDUCATIONAL EXPLAINER PAGE
// ============================================================================
interface GraphVisualizerPageProps {
  state: AppDataState;
  conflictGraph: ConflictGraph;
}

export const GraphVisualizerPage: React.FC<GraphVisualizerPageProps> = ({
  state,
  conflictGraph,
}) => {
  const [colorMode, setColorMode] = useState<'AFTER_COLORING' | 'BEFORE_COLORING'>(
    'AFTER_COLORING'
  );
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [teacherFilter, setTeacherFilter] = useState<string>('ALL');
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(
    conflictGraph.vertices[0]?.eventId || null
  );
  const [showMiniExplainer, setShowMiniExplainer] = useState<boolean>(true);

  const latest = state.latestResult;
  const scheduledMap = useMemo(() => {
    const map = new Map<
      string,
      { slotKey: string; colorIndex: number; roomName: string; occupiedSlotKeys: string[] }
    >();
    if (latest) {
      for (const s of latest.scheduledSessions) {
        map.set(s.eventId, {
          slotKey: s.startSlotKey,
          colorIndex: s.colorIndex,
          roomName: s.roomName,
          occupiedSlotKeys: s.occupiedSlotKeys,
        });
      }
    }
    return map;
  }, [latest]);

  // Filter vertices for interactive SVG layout
  const filteredVertices = useMemo(() => {
    return conflictGraph.vertices.filter((v) => {
      if (
        sectionFilter !== 'ALL' &&
        !v.event.sectionIds.includes(sectionFilter)
      ) {
        return false;
      }
      if (teacherFilter !== 'ALL' && v.event.teacherId !== teacherFilter) {
        return false;
      }
      return true;
    });
  }, [conflictGraph.vertices, sectionFilter, teacherFilter]);

  const visibleVertexIdSet = useMemo(
    () => new Set(filteredVertices.map((v) => v.eventId)),
    [filteredVertices]
  );

  const filteredEdges = useMemo(() => {
    return conflictGraph.edges.filter(
      (e) => visibleVertexIdSet.has(e.source) && visibleVertexIdSet.has(e.target)
    );
  }, [conflictGraph.edges, visibleVertexIdSet]);

  // Calculate circular/concentric SVG coordinates for filteredVertices
  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const count = filteredVertices.length;
    const cx = 420;
    const cy = 290;

    if (count === 0) return pos;
    if (count <= 14) {
      const r = 215;
      filteredVertices.forEach((v, idx) => {
        const angle = (2 * Math.PI * idx) / count - Math.PI / 2;
        pos[v.eventId] = {
          x: Math.round(cx + r * Math.cos(angle)),
          y: Math.round(cy + r * Math.sin(angle)),
        };
      });
    } else {
      // Concentric dual rings for CSE-A (outer/left-ish) and CSE-B or inner ring so labels never overlap
      const innerCount = Math.ceil(count * 0.42);
      const outerCount = count - innerCount;
      filteredVertices.forEach((v, idx) => {
        if (idx < innerCount) {
          const angle = (2 * Math.PI * idx) / innerCount - Math.PI / 2;
          pos[v.eventId] = {
            x: Math.round(cx + 130 * Math.cos(angle)),
            y: Math.round(cy + 130 * Math.sin(angle)),
          };
        } else {
          const outerIdx = idx - innerCount;
          const angle = (2 * Math.PI * outerIdx) / outerCount - Math.PI / 2;
          pos[v.eventId] = {
            x: Math.round(cx + 240 * Math.cos(angle)),
            y: Math.round(cy + 240 * Math.sin(angle)),
          };
        }
      });
    }
    return pos;
  }, [filteredVertices]);

  const selectedVertex: GraphVertex | undefined = conflictGraph.vertices.find(
    (v) => v.eventId === selectedVertexId
  );

  const selectedNeighbors = useMemo(() => {
    if (!selectedVertex) return new Set<string>();
    return new Set(selectedVertex.neighbors);
  }, [selectedVertex]);

  // Compute dynamic saturation degree of selectedVertex based on colored neighbors
  const selectedVertexSaturation = useMemo(() => {
    if (!selectedVertex) return 0;
    const colors = new Set<string>();
    for (const nId of selectedVertex.neighbors) {
      const sched = scheduledMap.get(nId);
      if (sched) {
        for (const k of sched.occupiedSlotKeys) {
          colors.add(k);
        }
      }
    }
    return colors.size;
  }, [selectedVertex, scheduledMap]);

  return (
    <div className="space-y-8">
      {/* Section 4 Requirement: Dedicated "Graph Coloring Explained" 4-Event Interactive Educational Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Graph Coloring Explained — 4-Event Textbook Example (E1 to E4)
              </h2>
              <p className="text-xs text-slate-500">
                How vertices, conflict edges, adjacency lists, and time-slot colors work on a 4-session example
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowMiniExplainer(!showMiniExplainer)}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 cursor-pointer whitespace-nowrap shrink-0"
          >
            {showMiniExplainer ? 'Hide Textbook Example' : 'Show Textbook Example'}
          </button>
        </div>

        {showMiniExplainer && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left 5 cols: SVG Diagram of E1, E2, E3, E4 */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-700 mb-2 text-center">
                Conflict Graph G = (V, E) with 2-Color Assignment
              </div>
              <svg viewBox="0 0 420 240" className="w-full h-auto">
                {/* Edges: E1-E2 (Section CSE-A), E1-E3 (Shared Teacher Dr. Sharma), E3-E4 (Section CSE-B) */}
                <line x1="100" y1="65" x2="100" y2="175" stroke="#64748b" strokeWidth="2.5" />
                <text x="22" y="124" fontSize="10" fill="#475569" fontFamily="IBM Plex Mono">
                  CSE-A Clash
                </text>

                <line x1="100" y1="65" x2="310" y2="65" stroke="#e11d48" strokeWidth="2.5" strokeDasharray="5,4" />
                <text x="155" y="53" fontSize="10" fill="#be123c" fontFamily="IBM Plex Mono">
                  Shared Teacher (Dr. Sharma)
                </text>

                <line x1="310" y1="65" x2="310" y2="175" stroke="#64748b" strokeWidth="2.5" />
                <text x="320" y="124" fontSize="10" fill="#475569" fontFamily="IBM Plex Mono">
                  CSE-B Clash
                </text>

                {/* E1 Node */}
                <g transform="translate(100, 65)">
                  <circle r="32" fill="#4f46e5" stroke="#312e81" strokeWidth="2" />
                  <text textAnchor="middle" dy="-4" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="IBM Plex Mono">
                    E1: Math
                  </text>
                  <text textAnchor="middle" dy="10" fill="#e0e7ff" fontSize="9">
                    CSE-A · Color 1
                  </text>
                </g>

                {/* E2 Node */}
                <g transform="translate(100, 175)">
                  <circle r="32" fill="#0d9488" stroke="#115e59" strokeWidth="2" />
                  <text textAnchor="middle" dy="-4" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="IBM Plex Mono">
                    E2: DSA
                  </text>
                  <text textAnchor="middle" dy="10" fill="#ccfbf1" fontSize="9">
                    CSE-A · Color 2
                  </text>
                </g>

                {/* E3 Node */}
                <g transform="translate(310, 65)">
                  <circle r="32" fill="#0d9488" stroke="#115e59" strokeWidth="2" />
                  <text textAnchor="middle" dy="-4" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="IBM Plex Mono">
                    E3: Math
                  </text>
                  <text textAnchor="middle" dy="10" fill="#ccfbf1" fontSize="9">
                    CSE-B · Color 2
                  </text>
                </g>

                {/* E4 Node */}
                <g transform="translate(310, 175)">
                  <circle r="32" fill="#4f46e5" stroke="#312e81" strokeWidth="2" />
                  <text textAnchor="middle" dy="-4" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="IBM Plex Mono">
                    E4: OS
                  </text>
                  <text textAnchor="middle" dy="10" fill="#e0e7ff" fontSize="9">
                    CSE-B · Color 1
                  </text>
                </g>
              </svg>
            </div>

            {/* Right 7 cols: Explanation, Adjacency List, and Assigned Slots */}
            <div className="lg:col-span-7 space-y-3 text-xs">
              <p className="text-slate-700 leading-relaxed">
                Consider 4 class-session events: <strong>E1</strong> (Mathematics for CSE-A, taught by Dr. Sharma), <strong>E2</strong> (Data Structures for CSE-A, taught by Prof. Verma), <strong>E3</strong> (Mathematics for CSE-B, also taught by Dr. Sharma), and <strong>E4</strong> (Operating Systems for CSE-B, taught by Prof. Krishnan).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="font-bold text-slate-900 mb-1">
                    Conflict Edges & Adjacency List
                  </div>
                  <ul className="space-y-1 font-mono text-[11px] text-slate-700">
                    <li>
                      <strong>Adj[E1]</strong> = [E2 (same section), E3 (same teacher)]
                    </li>
                    <li>
                      <strong>Adj[E2]</strong> = [E1 (same section CSE-A)]
                    </li>
                    <li>
                      <strong>Adj[E3]</strong> = [E1 (same teacher), E4 (same section)]
                    </li>
                    <li>
                      <strong>Adj[E4]</strong> = [E3 (same section CSE-B)]
                    </li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="font-bold text-slate-900 mb-1">
                    Valid 2-Color Schedule & Room Allocation
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    {MINI_EXAMPLE_DATA.events.map((ev) => (
                      <li key={ev.id}>
                        <span className="font-mono font-bold text-indigo-700">{ev.id}</span>:{' '}
                        {ev.assignedSlot} in <span className="font-semibold">{ev.room}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-slate-600 text-[11px]">
                Notice how <strong>E1</strong> and <strong>E4</strong> have no conflict edge between them (different sections and different teachers), so both can safely receive <strong>Color 1 (Monday, Period 1)</strong> and run simultaneously in Classroom 101 and Classroom 102!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Full Dataset Conflict Graph Visualizer */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900">
                Interactive Conflict Graph Visualizer
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Total Vertices |V| = {conflictGraph.vertices.length} · Total Conflict Edges |E| = {conflictGraph.edges.length} · Displayed: {filteredVertices.length} vertices, {filteredEdges.length} edges
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Before vs After Coloring Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setColorMode('BEFORE_COLORING')}
                className={`px-3 py-1.5 font-semibold rounded-md cursor-pointer transition-colors ${
                  colorMode === 'BEFORE_COLORING'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Before Coloring (Uncolored)
              </button>
              <button
                onClick={() => setColorMode('AFTER_COLORING')}
                className={`px-3 py-1.5 font-semibold rounded-md cursor-pointer transition-colors ${
                  colorMode === 'AFTER_COLORING'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                After Coloring (Time-Slot Colors)
              </button>
            </div>

            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Sections (Complete Graph)</option>
              {state.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Filter: Section {s.name}
                </option>
              ))}
            </select>

            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Teachers</option>
              {state.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  Filter: {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Canvas + Inspector Split */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Cols: Interactive SVG Graph Canvas */}
          <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <svg viewBox="0 0 840 580" className="w-full h-auto min-w-[540px]">
              {/* Render Edges */}
              {filteredEdges.map((edge) => {
                const p1 = nodePositions[edge.source];
                const p2 = nodePositions[edge.target];
                if (!p1 || !p2) return null;

                const isIncidentToSelected =
                  selectedVertexId === edge.source ||
                  selectedVertexId === edge.target;
                const isSharedTeacherOnly =
                  edge.reasons.includes('SHARED_TEACHER') &&
                  !edge.reasons.includes('SHARED_SECTION');

                return (
                  <line
                    key={edge.id}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={
                      isIncidentToSelected
                        ? isSharedTeacherOnly
                          ? '#e11d48'
                          : '#4f46e5'
                        : '#cbd5e1'
                    }
                    strokeWidth={isIncidentToSelected ? 2.4 : 1}
                    strokeOpacity={
                      selectedVertexId
                        ? isIncidentToSelected
                          ? 0.95
                          : 0.22
                        : 0.55
                    }
                    strokeDasharray={isSharedTeacherOnly ? '5,3' : undefined}
                  />
                );
              })}

              {/* Render Vertex Nodes */}
              {filteredVertices.map((vertex) => {
                const pos = nodePositions[vertex.eventId];
                if (!pos) return null;

                const sched = scheduledMap.get(vertex.eventId);
                const isSelected = selectedVertexId === vertex.eventId;
                const isNeighbor = selectedNeighbors.has(vertex.eventId);
                const dimmed =
                  selectedVertexId !== null && !isSelected && !isNeighbor;

                let fillHex = '#e2e8f0';
                let textFill = '#1e293b';
                if (colorMode === 'AFTER_COLORING') {
                  if (sched) {
                    fillHex = getSlotColorHex(sched.colorIndex);
                    textFill = '#ffffff';
                  } else {
                    fillHex = '#fef2f2'; // Unscheduled node state
                    textFill = '#b91c1c';
                  }
                }

                return (
                  <g
                    key={vertex.eventId}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => setSelectedVertexId(vertex.eventId)}
                    className="cursor-pointer"
                    opacity={dimmed ? 0.35 : 1}
                  >
                    {isSelected && (
                      <circle
                        r="31"
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="2.5"
                        strokeDasharray="3,2"
                      />
                    )}
                    <circle
                      r="25"
                      fill={fillHex}
                      stroke={
                        isSelected
                          ? '#0f172a'
                          : isNeighbor
                          ? '#4f46e5'
                          : '#475569'
                      }
                      strokeWidth={isSelected || isNeighbor ? '2.5' : '1.5'}
                    />
                    <text
                      textAnchor="middle"
                      dy="-3"
                      fill={textFill}
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="IBM Plex Mono"
                    >
                      {vertex.event.subjectCode}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="9"
                      fill={textFill}
                      fontSize="8.5"
                      fontFamily="IBM Plex Mono"
                    >
                      {vertex.event.sectionNames.join('+')}#{vertex.event.sessionIndex}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-500 inline-block" />
                  Uncolored State
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                  Colored (Assigned Time Slot)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-50 border border-red-600 inline-block" />
                  Unscheduled Vertex
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-0.5 bg-indigo-600 inline-block" />
                  Shared Section Edge
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-0.5 border-b-2 border-dashed border-rose-600 inline-block" />
                  Shared Teacher Edge
                </span>
              </div>
              <span className="font-mono text-slate-500">
                Click any node to highlight its conflicting neighbors
              </span>
            </div>
          </div>

          {/* Right 4 Cols: Selected Vertex & Neighbor Inspector */}
          <div className="lg:col-span-4 space-y-4">
            {selectedVertex ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div>
                  <div className="text-xs font-mono font-bold text-indigo-700">
                    Selected Vertex Inspector
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                    {selectedVertex.eventId}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {selectedVertex.event.subjectCode} — {selectedVertex.event.subjectName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Graph Degree</span>
                    <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                      {selectedVertex.degree} edges
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Saturation Degree</span>
                    <span className="text-base font-bold font-mono text-indigo-700 tabular-nums">
                      {selectedVertexSaturation} distinct colors
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Section & Teacher</span>
                    <span className="font-semibold text-slate-900 block truncate">
                      {selectedVertex.event.sectionNames.join(', ')} · {selectedVertex.event.teacherName}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Assigned Slot Color</span>
                    {scheduledMap.get(selectedVertex.eventId) ? (
                      <span className="font-mono font-bold text-emerald-700 block">
                        {scheduledMap.get(selectedVertex.eventId)!.slotKey} (C#{scheduledMap.get(selectedVertex.eventId)!.colorIndex})
                      </span>
                    ) : (
                      <span className="font-mono text-red-600 block">Unscheduled</span>
                    )}
                  </div>
                </div>

                {/* Adjacent Neighbors Verification */}
                <div>
                  <div className="text-xs font-bold text-slate-900 mb-2">
                    Conflicting Neighbors ({selectedVertex.neighbors.length}) — Must Use Different Slot Colors
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {selectedVertex.neighbors.map((nId) => {
                      const nSched = scheduledMap.get(nId);
                      const edgeReasons =
                        conflictGraph.edgeReasonsMap[
                          `${selectedVertex.eventId}__${nId}`
                        ] || [];
                      return (
                        <div
                          key={nId}
                          onClick={() => setSelectedVertexId(nId)}
                          className="p-2 bg-white border border-slate-200 rounded-lg text-[11px] flex items-center justify-between hover:border-indigo-300 cursor-pointer"
                        >
                          <div>
                            <div className="font-mono font-bold text-slate-800">
                              {nId}
                            </div>
                            <div className="text-slate-500">
                              {edgeReasons.includes('SHARED_TEACHER') &&
                              edgeReasons.includes('SHARED_SECTION')
                                ? 'Shared Section + Teacher'
                                : edgeReasons.includes('SHARED_TEACHER')
                                ? 'Shared Teacher'
                                : 'Shared Section'}
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            {nSched ? (
                              <span
                                className="font-semibold px-1.5 py-0.5 rounded text-white"
                                style={{
                                  backgroundColor: getSlotColorHex(nSched.colorIndex),
                                }}
                              >
                                {nSched.slotKey} (C#{nSched.colorIndex})
                              </span>
                            ) : (
                              <span className="text-slate-400">Uncolored</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                Select any vertex in the conflict graph to inspect its neighbors and assigned time-slot color.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Adjacency List Representation Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          Conflict Graph Adjacency List Representation ({filteredVertices.length} Vertices)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Shows each class-session vertex, its degree, its assigned time-slot color, and all adjacent conflicting vertices.
        </p>

        <div className="mt-4 overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="py-2.5 px-3">Vertex ID</th>
                <th className="py-2.5 px-3">Subject & Section</th>
                <th className="py-2.5 px-3">Teacher</th>
                <th className="py-2.5 px-3 text-right">Degree</th>
                <th className="py-2.5 px-3">Assigned Slot Color</th>
                <th className="py-2.5 px-3">Adjacency List (Conflicting Event IDs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredVertices.map((v) => {
                const sched = scheduledMap.get(v.eventId);
                return (
                  <tr
                    key={v.eventId}
                    onClick={() => setSelectedVertexId(v.eventId)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      selectedVertexId === v.eventId ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                      {v.eventId}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">
                        {v.event.subjectCode}
                      </span>{' '}
                      ({v.event.sectionNames.join(', ')})
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {v.event.teacherName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                      {v.degree}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {sched ? (
                        <span className="font-semibold text-emerald-700">
                          {sched.occupiedSlotKeys.join(', ')} [C#{sched.colorIndex}]
                        </span>
                      ) : (
                        <span className="text-red-600">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {v.neighbors.join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
