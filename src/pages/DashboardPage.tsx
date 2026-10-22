import React from 'react';
import {
  Play,
  Calendar,
  Network,
  FileDown,
  RotateCcw,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  AppDataState,
  ConflictGraph,
  ClassSessionEvent,
  NavigationTab,
  TimeSlot,
} from '../types/timetable';
import { downloadScheduledTimetableCsv } from '../utils/storageAndExport';

interface DashboardPageProps {
  state: AppDataState;
  events: ClassSessionEvent[];
  conflictGraph: ConflictGraph;
  availableSlots: TimeSlot[];
  onNavigate: (tab: NavigationTab) => void;
  onQuickGenerate: () => void;
  onRequestLoadDemo: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  state,
  events,
  conflictGraph,
  availableSlots,
  onNavigate,
  onQuickGenerate,
  onRequestLoadDemo,
}) => {
  const latest = state.latestResult;
  const totalRequiredSessions = events.length;
  const scheduledCount = latest ? latest.scheduledSessions.length : 0;
  const unscheduledCount = latest
    ? latest.unscheduledSessions.length
    : totalRequiredSessions;
  const hardViolations = latest ? latest.validation.hardViolationsCount : 0;
  const completionPct =
    totalRequiredSessions > 0
      ? Math.round((scheduledCount / totalRequiredSessions) * 100)
      : 0;
  const occupiedSlotsCount = latest ? latest.distinctSlotsUsed : 0;

  const [previewSectionId, setPreviewSectionId] = React.useState<string>(
    state.sections[0]?.id || ''
  );

  React.useEffect(() => {
    if (
      state.sections.length > 0 &&
      !state.sections.some((s) => s.id === previewSectionId)
    ) {
      setPreviewSectionId(state.sections[0].id);
    }
  }, [state.sections, previewSectionId]);

  const teachingPeriods = state.calendar.periods.filter((p) => !p.isBreak);

  return (
    <div className="space-y-8">
      {/* Hero & Prominent Quick Actions */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-medium text-indigo-700">
              <span>Design & Analysis of Algorithms (DAA)</span>
              <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
              <span>Graph Coloring Scheduler</span>
              {state.isDemoData && (
                <>
                  <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
                  <span className="text-teal-700">Illustrative College Demo Dataset Active</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Automated Timetable Generator
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Smart Academic Scheduling Powered by Graph Coloring — mapping weekly class-session meetings to conflict-graph vertices, teacher/section exclusions to undirected edges, and timetable periods to colors.
            </p>
            <p className="text-xs text-slate-500 pt-1">
              <span>{state.calendar.institutionName}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{state.calendar.department}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{state.calendar.academicYear} ({state.calendar.semester})</span>
            </p>
          </div>

          {/* Prominent Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onQuickGenerate}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              Generate Timetable
            </button>
            <button
              onClick={() => onNavigate('viewer')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              View Latest Timetable
            </button>
            <button
              onClick={() => onNavigate('graph')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Network className="w-3.5 h-3.5 text-teal-600" />
              View Graph
            </button>
            <button
              onClick={() => onNavigate('subjects')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-600" />
              Add Academic Data
            </button>
            <button
              onClick={() => {
                if (latest && latest.scheduledSessions.length > 0) {
                  downloadScheduledTimetableCsv(latest.scheduledSessions, state.calendar);
                } else {
                  onNavigate('reports');
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-600" />
              Download Report
            </button>
            <button
              onClick={onRequestLoadDemo}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Load Demo Dataset
            </button>
          </div>
        </div>
      </section>

      {/* Primary KPI Grid — All 11 Required Live Statistics */}
      <section aria-label="Dataset and Schedule Statistics">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Total Sections</p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {state.sections.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {state.sections.reduce((acc, s) => acc + s.studentStrength, 0)} total students
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Total Teachers</p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {state.teachers.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Active faculty members
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Total Subjects</p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {state.subjects.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {state.subjects.filter((s) => s.sessionType === 'Laboratory').length} labs · {state.subjects.filter((s) => s.sessionType === 'Lecture').length} lectures
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Total Classrooms</p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {state.classrooms.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {state.classrooms.filter((r) => r.roomType === 'Classroom').length} rooms · {state.classrooms.filter((r) => r.roomType !== 'Classroom').length} labs
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Required Weekly Sessions</p>
            <p className="mt-1.5 text-2xl font-bold text-indigo-600 font-mono tabular-nums">
              {totalRequiredSessions}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Expanded session vertices
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Timetable Completion</p>
            <p className="mt-1.5 text-2xl font-bold text-teal-600 font-mono tabular-nums">
              {completionPct}%
            </p>
            <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              {scheduledCount} / {totalRequiredSessions} scheduled
            </p>
          </div>
        </div>

        {/* Second row of required graph & scheduling metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Scheduled Sessions</p>
            <p className="mt-1 text-xl font-bold text-emerald-700 font-mono tabular-nums">
              {scheduledCount}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Assigned valid slot & room
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Unscheduled Sessions</p>
            <p className={`mt-1 text-xl font-bold font-mono tabular-nums ${unscheduledCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {unscheduledCount}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {unscheduledCount === 0 ? 'Zero pending events' : 'Requires attention'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Hard Constraint Violations</p>
            <div className="mt-1 flex items-center gap-1.5">
              {hardViolations === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span className={`text-xl font-bold font-mono tabular-nums ${hardViolations === 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {hardViolations}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {latest ? latest.validation.statusLabel.split('—')[0] : 'Not validated'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500">Occupied Timetable Slots</p>
            <p className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
              {occupiedSlotsCount} / {availableSlots.length}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Distinct time-slot colors used
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-slate-500">Conflict Graph (V, E)</p>
            <p className="mt-1 text-xl font-bold text-indigo-700 font-mono tabular-nums">
              |V|={conflictGraph.vertices.length}, |E|={conflictGraph.edges.length}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Undirected exclusion graph
            </p>
          </div>
        </div>
      </section>

      {/* Main Two-Column Content: Weekly Schedule Preview & Resource/Activity Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Weekly Schedule Preview */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Weekly Schedule Preview
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {latest
                  ? `Generated via ${latest.algorithmLabel} in ${latest.executionTimeMs}ms`
                  : 'No timetable generated yet'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {state.sections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => setPreviewSectionId(sec.id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      previewSectionId === sec.id
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onNavigate('viewer')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                Full Grid <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {latest && latest.scheduledSessions.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-3 w-24">Day</th>
                    {teachingPeriods.map((p) => (
                      <th key={p.periodNumber} className="py-2.5 px-2 text-center">
                        <div>{p.name}</div>
                        <div className="text-[11px] font-normal text-slate-400 font-mono tabular-nums">
                          {p.startTime}–{p.endTime}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {state.calendar.workingDays.map((day) => (
                    <tr key={day} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {day}
                      </td>
                      {teachingPeriods.map((period) => {
                        const slotKey = `${day}-P${period.periodNumber}`;
                        const session = latest.scheduledSessions.find(
                          (s) =>
                            s.event.sectionIds.includes(previewSectionId) &&
                            s.occupiedSlotKeys.includes(slotKey)
                        );
                        const secObj = state.sections.find((s) => s.id === previewSectionId);
                        const isSecUnavailable = secObj?.unavailableSlots.includes(slotKey);

                        if (!session) {
                          return (
                            <td
                              key={period.periodNumber}
                              className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]"
                            >
                              {isSecUnavailable ? 'Reserved' : '—'}
                            </td>
                          );
                        }

                        return (
                          <td key={period.periodNumber} className="py-2 px-1.5">
                            <div
                              onClick={() => onNavigate('viewer')}
                              className="p-2 rounded-lg border border-slate-200 bg-slate-50/80 hover:border-indigo-300 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className="font-bold text-slate-900 font-mono"
                                  style={{ color: session.event.colorHex }}
                                >
                                  {session.event.subjectCode}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  C#{session.colorIndex}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                {session.roomName}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-600">
                No timetable is currently generated.
              </p>
              <button
                onClick={onQuickGenerate}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Run DSATUR Scheduler Now
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Resource Summary & Recent Activity */}
        <div className="space-y-6">
          {/* Resource Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900">
              Academic Resource Summary
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Capacity and constraint overview across entities
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Working Calendar Slots</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {availableSlots.length} teaching periods / wk
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Lecture Classrooms</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {state.classrooms.filter((r) => r.roomType === 'Classroom').length} rooms
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Laboratory Facilities</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {state.classrooms.filter((r) => r.roomType !== 'Classroom').length} labs
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Max Vertex Degree (Δ)</span>
                <span className="font-mono font-semibold text-indigo-700 tabular-nums">
                  {conflictGraph.vertices.length > 0
                    ? Math.max(...conflictGraph.vertices.map((v) => v.degree))
                    : 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Soft Quality Score</span>
                <span className="font-mono font-semibold text-teal-700 tabular-nums">
                  {latest ? `${latest.validation.softScore.overallScore} / 100` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900">
              Recent Activity Log
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest dataset edits and algorithm runs
            </p>

            <div className="mt-4 divide-y divide-slate-100">
              {state.activityLog.slice(0, 5).map((item) => (
                <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{item.action}</span>
                    <span className="text-slate-400 font-mono tabular-nums text-[11px]">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {item.details}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
