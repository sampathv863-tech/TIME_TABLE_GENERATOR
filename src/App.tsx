import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  BookOpen,
  Building2,
  Cpu,
  Table2,
  ShieldAlert,
  Network,
  FlaskConical,
  BarChart3,
  GraduationCap,
  Settings,
  Menu,
  X,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import {
  AcademicCalendar,
  AlgorithmType,
  AppDataState,
  Classroom,
  NavigationTab,
  ScheduledSession,
  SoftConstraintWeights,
  StudentSection,
  SubjectRequirement,
  Teacher,
} from './types/timetable';
import {
  expandSubjectRequirementsToEvents,
  generateAvailableTimeSlots,
  validateAcademicInputs,
} from './algorithms/eventGenerator';
import { buildConflictGraph } from './algorithms/conflictGraph';
import { runTimetableColoringEngine } from './algorithms/coloringEngine';
import { runIndependentTimetableValidator } from './algorithms/validator';
import {
  initializeDefaultStateWithSchedule,
  loadAppStateFromStorage,
  saveAppStateToStorage,
} from './utils/storageAndExport';
import { DashboardPage } from './pages/DashboardPage';
import {
  AcademicSetupPage,
  ManageSectionsPage,
  ManageTeachersPage,
  ManageSubjectsPage,
  ManageClassroomsPage,
} from './pages/AcademicManagementPages';
import {
  GenerateTimetablePage,
  TimetableViewerPage,
} from './pages/GenerateAndViewerPages';
import {
  ConflictCheckerPage,
  GraphVisualizerPage,
} from './pages/ConflictAndGraphPages';
import {
  AlgorithmLabPage,
  ReportsPage,
} from './pages/AlgorithmLabAndReportsPages';
import {
  DAAProjectGuidePage,
  SettingsPage,
} from './pages/GuideAndSettingsPages';

interface SidebarNavItem {
  id: NavigationTab;
  label: string;
  icon: React.FC<{ className?: string }>;
  group: 'OVERVIEW' | 'ACADEMIC_DATA' | 'SCHEDULER' | 'ANALYSIS';
}

const SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'OVERVIEW' },
  { id: 'academic-setup', label: 'Academic Setup', icon: Calendar, group: 'ACADEMIC_DATA' },
  { id: 'sections', label: 'Manage Sections', icon: Users, group: 'ACADEMIC_DATA' },
  { id: 'teachers', label: 'Manage Teachers', icon: UserCheck, group: 'ACADEMIC_DATA' },
  { id: 'subjects', label: 'Manage Subjects', icon: BookOpen, group: 'ACADEMIC_DATA' },
  { id: 'classrooms', label: 'Manage Classrooms', icon: Building2, group: 'ACADEMIC_DATA' },
  { id: 'generate', label: 'Generate Timetable', icon: Cpu, group: 'SCHEDULER' },
  { id: 'viewer', label: 'Timetable Viewer', icon: Table2, group: 'SCHEDULER' },
  { id: 'conflicts', label: 'Conflict Checker', icon: ShieldAlert, group: 'SCHEDULER' },
  { id: 'graph', label: 'Graph Visualizer', icon: Network, group: 'ANALYSIS' },
  { id: 'algorithm-lab', label: 'Algorithm Lab', icon: FlaskConical, group: 'ANALYSIS' },
  { id: 'reports', label: 'Reports', icon: BarChart3, group: 'ANALYSIS' },
  { id: 'daa-guide', label: 'DAA Project Guide', icon: GraduationCap, group: 'ANALYSIS' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'ANALYSIS' },
];

export default function App() {
  const [state, setState] = useState<AppDataState>(() => loadAppStateFromStorage());
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmDemoModalOpen, setConfirmDemoModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persist state to localStorage on any change
  useEffect(() => {
    saveAppStateToStorage(state);
  }, [state]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Derived real-time graph & event calculations
  const events = useMemo(
    () =>
      expandSubjectRequirementsToEvents(
        state.subjects,
        state.teachers,
        state.sections
      ),
    [state.subjects, state.teachers, state.sections]
  );

  const conflictGraph = useMemo(() => buildConflictGraph(events), [events]);

  const availableSlots = useMemo(
    () => generateAvailableTimeSlots(state.calendar),
    [state.calendar]
  );

  const inputErrors = useMemo(
    () =>
      validateAcademicInputs(
        state.calendar,
        state.sections,
        state.teachers,
        state.subjects,
        state.classrooms
      ),
    [
      state.calendar,
      state.sections,
      state.teachers,
      state.subjects,
      state.classrooms,
    ]
  );

  const appendLog = (
    action: string,
    details: string,
    category: 'DATA' | 'ALGORITHM' | 'VALIDATION' | 'EXPORT' = 'DATA'
  ) => ({
    id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    action,
    details,
    category,
  });

  // Automatically re-run scheduler when academic entities are edited so graph & timetable stay in sync
  const updateAcademicDataAndRegenerate = (
    nextCalendar: AcademicCalendar,
    nextSections: StudentSection[],
    nextTeachers: Teacher[],
    nextSubjects: SubjectRequirement[],
    nextClassrooms: Classroom[],
    logDescription: string
  ) => {
    const newResult = runTimetableColoringEngine(
      state.preferredAlgorithm,
      nextCalendar,
      nextSections,
      nextTeachers,
      nextSubjects,
      nextClassrooms,
      state.softWeights,
      state.backtrackingNodeLimit
    );

    setState((prev) => ({
      ...prev,
      calendar: nextCalendar,
      sections: nextSections,
      teachers: nextTeachers,
      subjects: nextSubjects,
      classrooms: nextClassrooms,
      isDemoData: false,
      latestResult: newResult,
      comparisonResults: {
        ...prev.comparisonResults,
        [prev.preferredAlgorithm]: newResult,
      },
      activityLog: [
        appendLog('Academic Data Updated', logDescription, 'DATA'),
        ...prev.activityLog.slice(0, 19),
      ],
    }));
    showToast(`${logDescription}. Conflict graph & schedule updated.`);
  };

  const handleRunSingleAlgorithm = (
    algorithm: AlgorithmType,
    nodeLimit: number
  ) => {
    const res = runTimetableColoringEngine(
      algorithm,
      state.calendar,
      state.sections,
      state.teachers,
      state.subjects,
      state.classrooms,
      state.softWeights,
      nodeLimit
    );

    setState((prev) => ({
      ...prev,
      preferredAlgorithm: algorithm,
      backtrackingNodeLimit: nodeLimit,
      latestResult: res,
      comparisonResults: {
        ...prev.comparisonResults,
        [algorithm]: res,
      },
      activityLog: [
        appendLog(
          `Executed ${algorithm}`,
          `Scheduled ${res.scheduledSessions.length}/${res.totalEvents} events in ${res.executionTimeMs}ms (${res.validation.hardViolationsCount} hard violations).`,
          'ALGORITHM'
        ),
        ...prev.activityLog.slice(0, 19),
      ],
    }));

    showToast(
      `${res.algorithmLabel} completed in ${res.executionTimeMs}ms (${res.scheduledSessions.length}/${res.totalEvents} scheduled).`
    );
  };

  const handleRunAllComparison = (nodeLimit: number) => {
    const dsaturRes = runTimetableColoringEngine(
      'DSATUR',
      state.calendar,
      state.sections,
      state.teachers,
      state.subjects,
      state.classrooms,
      state.softWeights,
      nodeLimit
    );
    const greedyRes = runTimetableColoringEngine(
      'GREEDY',
      state.calendar,
      state.sections,
      state.teachers,
      state.subjects,
      state.classrooms,
      state.softWeights,
      nodeLimit
    );
    const backtrackRes = runTimetableColoringEngine(
      'BACKTRACKING',
      state.calendar,
      state.sections,
      state.teachers,
      state.subjects,
      state.classrooms,
      state.softWeights,
      nodeLimit
    );

    setState((prev) => ({
      ...prev,
      backtrackingNodeLimit: nodeLimit,
      latestResult: dsaturRes,
      comparisonResults: {
        DSATUR: dsaturRes,
        GREEDY: greedyRes,
        BACKTRACKING: backtrackRes,
      },
      activityLog: [
        appendLog(
          '3-Algorithm Benchmark Executed',
          `DSATUR: ${dsaturRes.executionTimeMs}ms · Greedy: ${greedyRes.executionTimeMs}ms · Backtracking: ${backtrackRes.executionTimeMs}ms`,
          'ALGORITHM'
        ),
        ...prev.activityLog.slice(0, 19),
      ],
    }));

    showToast('Executed empirical benchmark across DSATUR, Greedy, and Backtracking.');
  };

  const handleConfirmLoadDemo = () => {
    const freshDemo = initializeDefaultStateWithSchedule();
    setState(freshDemo);
    setConfirmDemoModalOpen(false);
    showToast('Restored illustrative college demo dataset and regenerated DSATUR timetable.');
  };

  const handleManualUpdateScheduledSessions = (
    updatedSessions: ScheduledSession[],
    logMsg: string
  ) => {
    if (!state.latestResult) return;

    const newValidation = runIndependentTimetableValidator(
      events,
      updatedSessions,
      state.latestResult.unscheduledSessions,
      state.calendar,
      state.sections,
      state.teachers,
      state.classrooms,
      state.softWeights
    );

    const distinctSlots = new Set<string>();
    for (const s of updatedSessions) {
      for (const k of s.occupiedSlotKeys) distinctSlots.add(k);
    }

    const updatedResult = {
      ...state.latestResult,
      scheduledSessions: updatedSessions,
      distinctSlotsUsed: distinctSlots.size,
      validation: newValidation,
    };

    setState((prev) => ({
      ...prev,
      latestResult: updatedResult,
      activityLog: [
        appendLog('Manual Session Rescheduled', logMsg, 'VALIDATION'),
        ...prev.activityLog.slice(0, 19),
      ],
    }));
    showToast('Session moved and verified by independent validator.');
  };

  const handleUpdateSoftWeights = (nextWeights: SoftConstraintWeights) => {
    setState((prev) => {
      if (!prev.latestResult) {
        return { ...prev, softWeights: nextWeights };
      }
      const revalidated = runIndependentTimetableValidator(
        events,
        prev.latestResult.scheduledSessions,
        prev.latestResult.unscheduledSessions,
        prev.calendar,
        prev.sections,
        prev.teachers,
        prev.classrooms,
        nextWeights
      );
      return {
        ...prev,
        softWeights: nextWeights,
        latestResult: {
          ...prev.latestResult,
          validation: revalidated,
        },
      };
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8 no-print">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
            className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="text-lg font-extrabold tracking-tight text-indigo-950 font-display whitespace-nowrap shrink-0"
          >
            TimeGrid
          </a>
        </div>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`hover:text-indigo-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'dashboard' ? 'text-indigo-700 underline' : ''
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('viewer')}
            className={`hover:text-indigo-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'viewer' ? 'text-indigo-700 underline' : ''
            }`}
          >
            Timetable Viewer
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`hover:text-indigo-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'graph' ? 'text-indigo-700 underline' : ''
            }`}
          >
            Conflict Graph
          </button>
          <button
            onClick={() => setActiveTab('algorithm-lab')}
            className={`hover:text-indigo-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'algorithm-lab' ? 'text-indigo-700 underline' : ''
            }`}
          >
            Algorithm Lab
          </button>
          <button
            onClick={() => setActiveTab('daa-guide')}
            className={`hover:text-indigo-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'daa-guide' ? 'text-indigo-700 underline' : ''
            }`}
          >
            DAA Guide
          </button>
        </nav>

        {/* Zone 3: 1 primary action button */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => {
              handleRunSingleAlgorithm(
                state.preferredAlgorithm,
                state.backtrackingNodeLimit
              );
              setActiveTab('viewer');
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Generate Timetable
          </button>
        </div>
      </header>

      {/* Main Workspace Container: Left Sidebar + Viewport */}
      <div className="flex-1 flex">
        {/* Left Sidebar Navigation (Desktop + Mobile Drawer) */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-150 ease-out no-print ${
            mobileMenuOpen ? 'translate-x-0 pt-14 lg:pt-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-4 space-y-5 overflow-y-auto">
            {(
              [
                { group: 'OVERVIEW', title: 'Overview' },
                { group: 'ACADEMIC_DATA', title: 'Academic Setup & Data' },
                { group: 'SCHEDULER', title: 'Timetable & Validation' },
                { group: 'ANALYSIS', title: 'Graph, Lab & Reports' },
              ] as const
            ).map((sec) => (
              <div key={sec.group}>
                <div className="px-3 mb-1.5 text-[11px] font-bold text-slate-400 tracking-wide">
                  {sec.title}
                </div>
                <div className="space-y-0.5">
                  {SIDEBAR_ITEMS.filter((item) => item.group === sec.group).map(
                    (item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              active ? 'text-indigo-600' : 'text-slate-400'
                            }`}
                          />
                          <span>{item.label}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar Bottom Summary */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/60 text-[11px] text-slate-500 space-y-1">
            <div className="font-semibold text-slate-800">
              Graph State: |V|={conflictGraph.vertices.length}, |E|={conflictGraph.edges.length}
            </div>
            <div>
              Available Colors: k={availableSlots.length} slots
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden no-print"
          />
        )}

        {/* Active Page Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1360px] mx-auto w-full">
          {toastMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardPage
              state={state}
              events={events}
              conflictGraph={conflictGraph}
              availableSlots={availableSlots}
              onNavigate={setActiveTab}
              onQuickGenerate={() =>
                handleRunSingleAlgorithm(
                  state.preferredAlgorithm,
                  state.backtrackingNodeLimit
                )
              }
              onRequestLoadDemo={() => setConfirmDemoModalOpen(true)}
            />
          )}

          {activeTab === 'academic-setup' && (
            <AcademicSetupPage
              calendar={state.calendar}
              onUpdateCalendar={(nextCal, msg) =>
                updateAcademicDataAndRegenerate(
                  nextCal,
                  state.sections,
                  state.teachers,
                  state.subjects,
                  state.classrooms,
                  msg
                )
              }
            />
          )}

          {activeTab === 'sections' && (
            <ManageSectionsPage
              sections={state.sections}
              calendar={state.calendar}
              onUpdateSections={(nextSec, msg) =>
                updateAcademicDataAndRegenerate(
                  state.calendar,
                  nextSec,
                  state.teachers,
                  state.subjects,
                  state.classrooms,
                  msg
                )
              }
            />
          )}

          {activeTab === 'teachers' && (
            <ManageTeachersPage
              teachers={state.teachers}
              calendar={state.calendar}
              onUpdateTeachers={(nextTch, msg) =>
                updateAcademicDataAndRegenerate(
                  state.calendar,
                  state.sections,
                  nextTch,
                  state.subjects,
                  state.classrooms,
                  msg
                )
              }
            />
          )}

          {activeTab === 'subjects' && (
            <ManageSubjectsPage
              subjects={state.subjects}
              teachers={state.teachers}
              sections={state.sections}
              calendar={state.calendar}
              onUpdateSubjects={(nextSub, msg) =>
                updateAcademicDataAndRegenerate(
                  state.calendar,
                  state.sections,
                  state.teachers,
                  nextSub,
                  state.classrooms,
                  msg
                )
              }
            />
          )}

          {activeTab === 'classrooms' && (
            <ManageClassroomsPage
              classrooms={state.classrooms}
              calendar={state.calendar}
              onUpdateClassrooms={(nextRooms, msg) =>
                updateAcademicDataAndRegenerate(
                  state.calendar,
                  state.sections,
                  state.teachers,
                  state.subjects,
                  nextRooms,
                  msg
                )
              }
            />
          )}

          {activeTab === 'generate' && (
            <GenerateTimetablePage
              state={state}
              events={events}
              conflictGraph={conflictGraph}
              availableSlots={availableSlots}
              inputErrors={inputErrors}
              onRunSingleAlgorithm={handleRunSingleAlgorithm}
              onRunAllComparison={handleRunAllComparison}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'viewer' && (
            <TimetableViewerPage
              state={state}
              availableSlots={availableSlots}
              conflictGraph={conflictGraph}
              onUpdateScheduledSessions={handleManualUpdateScheduledSessions}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'conflicts' && (
            <ConflictCheckerPage state={state} events={events} />
          )}

          {activeTab === 'graph' && (
            <GraphVisualizerPage state={state} conflictGraph={conflictGraph} />
          )}

          {activeTab === 'algorithm-lab' && <AlgorithmLabPage state={state} />}

          {activeTab === 'reports' && (
            <ReportsPage
              state={state}
              events={events}
              conflictGraph={conflictGraph}
            />
          )}

          {activeTab === 'daa-guide' && <DAAProjectGuidePage />}

          {activeTab === 'settings' && (
            <SettingsPage
              state={state}
              onUpdateSoftWeights={handleUpdateSoftWeights}
              onUpdateAlgorithmPrefs={(alg, limit) => {
                setState((prev) => ({
                  ...prev,
                  preferredAlgorithm: alg,
                  backtrackingNodeLimit: limit,
                }));
                showToast(`Saved default algorithm (${alg}) and node limit (${limit}).`);
              }}
              onClearTimetableOnly={() => {
                setState((prev) => ({
                  ...prev,
                  latestResult: null,
                  comparisonResults: {
                    DSATUR: null,
                    GREEDY: null,
                    BACKTRACKING: null,
                  },
                }));
                showToast('Cleared generated timetable while preserving all academic setup data.');
              }}
              onRequestLoadDemo={() => setConfirmDemoModalOpen(true)}
              onImportValidState={(imported) => {
                setState(imported);
                showToast('Imported JSON backup dataset.');
              }}
            />
          )}
        </main>
      </div>

      {/* Confirmation Modal for Restoring Demo Dataset */}
      {confirmDemoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
              <RotateCcw className="w-5 h-5 text-indigo-600" />
              Restore Illustrative College Demo Dataset?
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will replace any custom edits to sections, teachers, subjects, or rooms with the default illustrative college dataset (CSE-A & CSE-B, 7 teachers, 14 subject requirements, 5 classrooms/labs) and run the DSATUR scheduler.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setConfirmDemoModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLoadDemo}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
              >
                Restore Demo Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
