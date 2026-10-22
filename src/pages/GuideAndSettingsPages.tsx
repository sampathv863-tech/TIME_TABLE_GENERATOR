import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Sliders,
  RotateCcw,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  AlgorithmType,
  AppDataState,
  SoftConstraintWeights,
} from '../types/timetable';
import {
  exportAppStateToJson,
  validateAndParseImportedJson,
} from '../utils/storageAndExport';

const VIVA_QUESTIONS = [
  {
    q: '1. What is graph coloring in Design and Analysis of Algorithms (DAA)?',
    a: 'Graph coloring is the assignment of labels (called "colors") to the vertices of a graph G = (V, E) such that no two adjacent vertices connected by an edge share the same color.',
  },
  {
    q: '2. What does a vertex (node) represent in this project?',
    a: 'Each vertex represents one individual weekly class-session meeting that needs to be scheduled. For example, if Discrete Mathematics for CSE-A meets 3 times a week, it is expanded into 3 distinct vertices (E-MA301-CSE-A-1, E-MA301-CSE-A-2, E-MA301-CSE-A-3).',
  },
  {
    q: '3. What does an edge represent in the conflict graph?',
    a: 'An undirected edge between two vertices u and v represents a direct mutual-exclusion conflict—meaning those two class sessions cannot occur at the same time because they share the same teacher or share at least one participating student section.',
  },
  {
    q: '4. Why is a timetable time slot treated as a color?',
    a: 'In a timetable, events assigned to the same time slot (such as Monday, Period 1) occur simultaneously. By treating each time slot as a distinct color, the graph-coloring rule (adjacent vertices cannot have the same color) automatically guarantees that conflicting classes are never scheduled in the same time slot.',
  },
  {
    q: '5. Why is Greedy Graph Coloring (Welsh–Powell) used?',
    a: 'Greedy coloring with Welsh–Powell ordering sorts vertices in descending order of their degree so that the most heavily constrained classes (those with the most conflicts) are scheduled first, assigning each vertex the earliest feasible time slot in fast polynomial time.',
  },
  {
    q: '6. What is the DSATUR algorithm?',
    a: 'DSATUR stands for "Degree of Saturation" (introduced by Daniel Brélaz, 1979). Instead of using a fixed vertex order, DSATUR dynamically picks at each step the uncolored vertex whose neighbors already use the largest number of distinct colors, breaking ties by highest vertex degree.',
  },
  {
    q: '7. What is the difference between Vertex Degree and Saturation Degree?',
    a: 'Vertex Degree is static: it is the total number of adjacent conflicting vertices in the graph. Saturation Degree is dynamic: it is the number of distinct time-slot colors currently assigned to a vertex’s already-colored neighbors during algorithm execution.',
  },
  {
    q: '8. What is the difference between Greedy Coloring and Backtracking?',
    a: 'Greedy coloring makes a single forward pass and never undoes a previous slot assignment, making it very fast but occasionally unable to schedule a later vertex. Backtracking uses depth-first search (DFS) to reconsider and undo earlier assignments whenever a dead end is reached.',
  },
  {
    q: '9. Why can a greedy heuristic fail to find a complete schedule even when one exists?',
    a: 'Because greedy coloring commits to early color choices without looking ahead. An early assignment may inadvertently consume the last compatible room or available slot needed by a downstream event with strict teacher availability or 2-period lab requirements.',
  },
  {
    q: '10. What is the time and space complexity of the algorithms in this project?',
    a: 'Let V be the number of event vertices, E the number of conflict edges, and k the number of candidate time slots. Storing the adjacency list takes O(V + E) space and O(V + E) construction once conflicts are identified. A straightforward DSATUR selection phase takes O(V² + E) time (plus candidate slot and room checking). Backtracking has an exponential worst-case upper bound of O(k^V), bounded in practice by forward checking and a configurable search limit.',
  },
  {
    q: '11. How does the application prevent teacher clashes and student section clashes?',
    a: 'First, Stage 3 adds an edge in the conflict graph between any two events sharing a teacher or section. Second, Stage 5 forbids adjacent vertices from sharing any occupied period. Third, Stage 8 runs an independent validator that audits all pairs of scheduled sessions.',
  },
  {
    q: '12. Why is room allocation required in addition to basic graph coloring?',
    a: 'Two events with different teachers and different sections have no edge between them, so graph coloring allows them to share the same time slot. However, they cannot share the same physical classroom! Moreover, laboratories require Computer Labs and adequate seating capacity. Hence, integrated room allocation is essential.',
  },
  {
    q: '13. What is the difference between a Hard Constraint and a Soft Constraint?',
    a: 'A Hard Constraint is mandatory for schedule validity (e.g., no teacher double-booking, no classes during lunch break, room capacity >= enrollment, consecutive lab periods). A Soft Constraint is a desirable quality preference (e.g., spreading a subject across different weekdays, balancing daily faculty load) that improves the quality score but never overrides a hard constraint.',
  },
  {
    q: '14. Does DSATUR always guarantee a mathematically optimal timetable?',
    a: 'No. Graph coloring (and resource-constrained academic timetabling) is NP-hard in general. DSATUR is a highly effective polynomial-time heuristic that often produces complete, high-quality schedules on practical datasets, but it does not guarantee mathematical optimality on arbitrary graphs.',
  },
];

// ============================================================================
// 1. DAA PROJECT GUIDE PAGE (Section 17)
// ============================================================================
export const DAAProjectGuidePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredViva = VIVA_QUESTIONS.filter(
    (item) =>
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              DAA Project Guide — Graph Coloring for Automated Timetabling
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive theoretical reference, complexity analysis, and viva preparation guide for second-year Computer Science students.
            </p>
          </div>
        </div>
      </div>

      {/* Problem Statement, Why Graph Coloring, and Problem Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            01. Problem Statement
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Preparing a weekly college timetable manually requires coordinating dozens of subject lectures, multi-period laboratory sessions, faculty availability restrictions, student cohorts, and physical classrooms. As constraints grow, manual scheduling frequently introduces teacher clashes, room double-bookings, or unscheduled classes. Our objective is to automate conflict-free timetable generation using graph algorithms.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            02. Why Graph Coloring?
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            The core rule of timetabling is mutual exclusion: two incompatible events cannot happen at the same time. Graph Coloring models this directly by representing each class meeting as a vertex, connecting mutually exclusive meetings with an undirected edge, and assigning time-slot "colors" so that no two connected vertices receive the same time slot.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="text-base font-bold text-slate-900">
            03. Problem Mapping
          </h2>
          <ul className="text-xs text-slate-600 space-y-1.5">
            <li>
              <strong className="text-slate-900">Vertices (V):</strong> Individual weekly class-session events (e.g., 3 weekly Math lectures = 3 vertices).
            </li>
            <li>
              <strong className="text-slate-900">Edges (E):</strong> Mutual-exclusion conflicts (shared teacher or shared student section).
            </li>
            <li>
              <strong className="text-slate-900">Colors (k):</strong> Valid timetable time slots (e.g., Monday Period 1).
            </li>
            <li>
              <strong className="text-slate-900">Color Assignment:</strong> Assigning a conflict-free time slot to each event.
            </li>
            <li>
              <strong className="text-slate-900">Room Allocation:</strong> Resource constraint ensuring capacity & room type compatibility.
            </li>
          </ul>
        </div>
      </div>

      {/* End-to-End Algorithm Workflow Diagram */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          04. End-to-End Algorithm Workflow
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          {[
            '1. Academic Input',
            '2. Session Expansion',
            '3. Conflict Graph Construction',
            '4. Graph Coloring (DSATUR / Greedy / Backtracking)',
            '5. Integrated Room Allocation',
            '6. Independent Validation',
            '7. Timetable Output',
          ].map((step, i, arr) => (
            <React.Fragment key={step}>
              <div className="px-3.5 py-2.5 rounded-lg border border-indigo-200 bg-indigo-50/60 text-indigo-950">
                {step}
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Algorithm Explanations & Complexity Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            05. Core Concepts & Implemented Algorithms
          </h2>
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div>
              <strong className="text-slate-900 block">
                Adjacency List Representation:
              </strong>
              Each vertex stores a list of its conflicting neighbor IDs (`Adj[v]`). Unlike an adjacency matrix ($O(V^2)$ space), an adjacency list requires $O(V + E)$ space and allows iterating over a vertex's conflicts in time proportional to its degree.
            </div>
            <div>
              <strong className="text-slate-900 block">
                Greedy Coloring & Welsh–Powell Ordering:
              </strong>
              Sorts vertices once by descending degree (`deg(v)`) so highly constrained classes are colored first using the earliest feasible slot (First-Fit).
            </div>
            <div>
              <strong className="text-slate-900 block">
                DSATUR (Degree of Saturation):
              </strong>
              Maintains the dynamic saturation degree for each uncolored vertex (the count of distinct time-slot colors already used by its colored neighbors). At each step, the vertex with the highest saturation degree is colored next, prioritizing vertices whose valid options are shrinking fastest.
            </div>
            <div>
              <strong className="text-slate-900 block">
                Backtracking Graph Coloring:
              </strong>
              Uses recursive depth-first search with forward checking to try valid slot-and-room pairs and backtrack whenever a downstream vertex has zero feasible options, bounded by a configurable search limit.
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            06. Time & Space Complexity Analysis
          </h2>
          <p className="text-xs text-slate-600">
            Let <code className="font-mono font-bold text-indigo-700">V</code> = number of expanded class-session event vertices,{' '}
            <code className="font-mono font-bold text-indigo-700">E</code> = number of conflict edges, and{' '}
            <code className="font-mono font-bold text-indigo-700">k</code> = number of candidate timetable time slots.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2 px-2">Phase / Algorithm</th>
                  <th className="py-2 px-2">Time Complexity</th>
                  <th className="py-2 px-2">Space Complexity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2.5 px-2 font-semibold text-slate-900">
                    Adjacency List Storage & Traversal
                  </td>
                  <td className="py-2.5 px-2 font-mono text-indigo-700">
                    O(V + E) (after O(V²) pair check)
                  </td>
                  <td className="py-2.5 px-2 font-mono text-slate-700">O(V + E)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-2 font-semibold text-slate-900">
                    Greedy Coloring (Welsh–Powell)
                  </td>
                  <td className="py-2.5 px-2 font-mono text-indigo-700">
                    O(V log V + V · k + E)
                  </td>
                  <td className="py-2.5 px-2 font-mono text-slate-700">O(V + E)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-2 font-semibold text-slate-900">
                    DSATUR Selection Phase
                  </td>
                  <td className="py-2.5 px-2 font-mono text-indigo-700">
                    O(V² + E) (+ slot & room checks)
                  </td>
                  <td className="py-2.5 px-2 font-mono text-slate-700">O(V + E)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-2 font-semibold text-slate-900">
                    Backtracking Coloring
                  </td>
                  <td className="py-2.5 px-2 font-mono text-indigo-700">
                    O(k^V) worst-case upper bound
                  </td>
                  <td className="py-2.5 px-2 font-mono text-slate-700">O(V + E)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Note: In a straightforward DSATUR implementation that scans remaining uncolored vertices at each of the V steps, the vertex-selection and saturation tracking phase takes O(V² + E) time, while candidate evaluation additionally checks k time slots, room capacities, and soft-constraint penalties.
          </p>
        </div>
      </div>

      {/* Advantages, Limitations, and Future Enhancements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h3 className="text-sm font-bold text-emerald-800">07. Advantages</h3>
          <ul className="list-disc list-inside text-slate-600 space-y-1.5">
            <li>Eliminates manual scheduling errors and double-bookings.</li>
            <li>Explicitly separates hard validity rules from soft quality preferences.</li>
            <li>Enables rapid regeneration when faculty or room availability changes.</li>
            <li>Provides transparent conflict diagnostics and step-by-step traces.</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h3 className="text-sm font-bold text-amber-800">08. Limitations</h3>
          <ul className="list-disc list-inside text-slate-600 space-y-1.5">
            <li>General graph coloring and timetabling are NP-hard problems.</li>
            <li>Polynomial heuristics (Greedy, DSATUR) do not guarantee mathematical optimality.</li>
            <li>Multi-period consecutive labs and room capacities add constraints beyond pure vertex coloring.</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h3 className="text-sm font-bold text-indigo-800">09. Future Enhancements</h3>
          <ul className="list-disc list-inside text-slate-600 space-y-1.5">
            <li>Multi-department cloud database synchronization with role-based access.</li>
            <li>Metaheuristic post-optimizers (Simulated Annealing / Tabu Search).</li>
            <li>Direct ERP / Google Calendar / iCal feed integration for students.</li>
          </ul>
        </div>
      </div>

      {/* Viva Questions & Answers */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                10. DAA Project Viva Questions & Answers ({VIVA_QUESTIONS.length} Questions)
              </h2>
              <p className="text-xs text-slate-500">
                Essential oral examination questions and concise answers for your project evaluation.
              </p>
            </div>
          </div>

          <input
            type="text"
            placeholder="Filter viva questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-full sm:w-64"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredViva.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5"
            >
              <h3 className="text-xs font-bold text-slate-900">{item.q}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. SETTINGS & DATA MANAGEMENT PAGE (Section 18)
// ============================================================================
interface SettingsPageProps {
  state: AppDataState;
  onUpdateSoftWeights: (weights: SoftConstraintWeights) => void;
  onUpdateAlgorithmPrefs: (alg: AlgorithmType, nodeLimit: number) => void;
  onClearTimetableOnly: () => void;
  onRequestLoadDemo: () => void;
  onImportValidState: (imported: AppDataState) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  state,
  onUpdateSoftWeights,
  onUpdateAlgorithmPrefs,
  onClearTimetableOnly,
  onRequestLoadDemo,
  onImportValidState,
}) => {
  const [weights, setWeights] = useState<SoftConstraintWeights>(state.softWeights);
  const [prefAlg, setPrefAlg] = useState<AlgorithmType>(state.preferredAlgorithm);
  const [nodeLimit, setNodeLimit] = useState<number>(state.backtrackingNodeLimit);
  const [confirmClearTimetable, setConfirmClearTimetable] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'SUCCESS' | 'ERROR';
    message: string;
  } | null>(null);

  const handleToggleWeight = (key: keyof SoftConstraintWeights) => {
    const next: SoftConstraintWeights = {
      ...weights,
      [key]: {
        ...weights[key],
        enabled: !weights[key].enabled,
      },
    };
    setWeights(next);
    onUpdateSoftWeights(next);
  };

  const handleChangeWeightValue = (
    key: keyof SoftConstraintWeights,
    val: number
  ) => {
    const next: SoftConstraintWeights = {
      ...weights,
      [key]: {
        ...weights[key],
        weight: Math.max(0, Math.min(50, val)),
      },
    };
    setWeights(next);
    onUpdateSoftWeights(next);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const result = validateAndParseImportedJson(content);
      if (result.valid && result.state) {
        onImportValidState(result.state);
        setImportFeedback({
          type: 'SUCCESS',
          message: `Successfully validated and imported dataset (${result.state.sections.length} sections, ${result.state.subjects.length} subjects).`,
        });
      } else {
        setImportFeedback({
          type: 'ERROR',
          message: result.error || 'Failed to validate JSON backup structure.',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      {/* Soft Constraint Weights Configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Soft-Constraint Preferences & Quality Scoring Weights
            </h1>
            <p className="text-xs text-slate-500">
              Enable or disable optional scheduling preferences and configure their weights. Soft preferences never override hard constraints.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {(
            [
              {
                key: 'distributeSubjectDays',
                title: 'Distribute Repeated Subject Sessions Over Week',
                desc: 'Penalizes scheduling the same subject multiple times on the same day.',
              },
              {
                key: 'avoidConsecutiveSameSubject',
                title: 'Avoid Consecutive Same-Subject Lectures',
                desc: 'Prevents back-to-back 1-period lectures of the same subject.',
              },
              {
                key: 'respectPreferredSlots',
                title: 'Respect Subject Preferred Weekdays & Slots',
                desc: 'Rewards placing classes on their configured preferred days.',
              },
              {
                key: 'balanceTeacherDailyLoad',
                title: 'Balance Teacher Daily Teaching Load',
                desc: 'Penalizes exceeding a faculty member’s preferred daily period cap.',
              },
              {
                key: 'minimizeRoomChanges',
                title: 'Minimize Classroom Changes per Section',
                desc: 'Prefers keeping a student cohort in consistent primary classrooms.',
              },
              {
                key: 'minimizeSectionGaps',
                title: 'Minimize Isolated Gaps in Section Timetable',
                desc: 'Compacts classes to reduce idle waiting periods for students.',
              },
            ] as Array<{
              key: keyof SoftConstraintWeights;
              title: string;
              desc: string;
            }>
          ).map((item) => {
            const cfg = weights[item.key];
            return (
              <div
                key={item.key}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{item.title}</div>
                    <p className="text-slate-500 text-[11px] mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleWeight(item.key)}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer shrink-0 ${
                      cfg.enabled
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cfg.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                  <label className="text-slate-600 font-medium">
                    Criterion Weight: <span className="font-mono font-bold text-slate-900">{cfg.weight} pts</span>
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={40}
                    step={5}
                    disabled={!cfg.enabled}
                    value={cfg.weight}
                    onChange={(e) =>
                      handleChangeWeightValue(item.key, Number(e.target.value))
                    }
                    className="w-36 accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Algorithm Defaults */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-slate-900">
          Default Scheduler & Search Parameters
        </h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Default Graph Coloring Algorithm
            </label>
            <select
              value={prefAlg}
              onChange={(e) => setPrefAlg(e.target.value as AlgorithmType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="DSATUR">DSATUR (Degree of Saturation — Recommended)</option>
              <option value="GREEDY">Greedy Graph Coloring (Welsh–Powell)</option>
              <option value="BACKTRACKING">Backtracking Graph Coloring</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Backtracking Node Search Limit
            </label>
            <input
              type="number"
              min={100}
              max={50000}
              step={500}
              value={nodeLimit}
              onChange={(e) => setNodeLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <button
              onClick={() => onUpdateAlgorithmPrefs(prefAlg, nodeLimit)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
            >
              Save Algorithm Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Backup, Import, Clear Timetable, and Reset Demo Data */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Data Persistence, JSON Backups & Reset Controls
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            All academic data and generated timetables are persisted automatically in browser localStorage across refreshes.
          </p>
        </div>

        {importFeedback && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              importFeedback.type === 'SUCCESS'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {importFeedback.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{importFeedback.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => exportAppStateToJson(state)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Full JSON Backup
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            Import JSON Backup
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>

          {!confirmClearTimetable ? (
            <button
              onClick={() => setConfirmClearTimetable(true)}
              disabled={!state.latestResult}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Generated Timetable Only
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 p-1.5 rounded-lg bg-amber-50 border border-amber-300 text-xs">
              <span className="font-semibold text-amber-900 px-2">
                Clear schedule while keeping academic data?
              </span>
              <button
                onClick={() => {
                  onClearTimetableOnly();
                  setConfirmClearTimetable(false);
                }}
                className="px-2.5 py-1 bg-amber-700 text-white rounded font-semibold cursor-pointer"
              >
                Confirm Clear
              </button>
              <button
                onClick={() => setConfirmClearTimetable(false)}
                className="px-2.5 py-1 bg-white text-slate-700 border border-slate-200 rounded cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            onClick={onRequestLoadDemo}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restore Default Demo Dataset
          </button>
        </div>
      </div>
    </div>
  );
};
